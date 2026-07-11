//go:build js && wasm

package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"syscall/js"

	"github.com/nostalgia296/artemis/internal/pfs"
)

// In-memory handle registry for open archives.
var (
	mu      sync.Mutex
	handles       = make(map[int64]*pfs.Reader)
	nextH   int64 = 1

	globalProgress int32
)

func init() {
	pfs.OnProgress = func(current, total int) {
		if total > 0 {
			atomic.StoreInt32(&globalProgress, int32((current*100)/total))
		}
	}
}

func register(r *pfs.Reader) int64 {
	mu.Lock()
	defer mu.Unlock()
	h := nextH
	nextH++
	handles[h] = r
	return h
}

func getReader(h int64) (*pfs.Reader, bool) {
	mu.Lock()
	defer mu.Unlock()
	r, ok := handles[h]
	return r, ok
}

func remove(h int64) {
	mu.Lock()
	defer mu.Unlock()
	if r, ok := handles[h]; ok {
		_ = r.Close()
		delete(handles, h)
	}
}

type entryJSON struct {
	Name   string `json:"name"`
	Offset uint32 `json:"offset"`
	Size   uint32 `json:"size"`
}

// jsBytesFromUint8Array copies a JS Uint8Array into a Go []byte.
func jsBytesFromUint8Array(v js.Value) []byte {
	if v.IsNull() || v.IsUndefined() {
		return nil
	}
	n := v.Get("byteLength").Int()
	if n <= 0 {
		return []byte{}
	}
	out := make([]byte, n)
	js.CopyBytesToGo(out, v)
	return out
}

// jsUint8ArrayFromBytes creates a JS Uint8Array from Go bytes.
func jsUint8ArrayFromBytes(data []byte) js.Value {
	arr := js.Global().Get("Uint8Array").New(len(data))
	if len(data) > 0 {
		js.CopyBytesToJS(arr, data)
	}
	return arr
}

func promiseOf(fn func() (js.Value, error)) js.Value {
	var handler js.Func
	handler = js.FuncOf(func(this js.Value, args []js.Value) any {
		resolve := args[0]
		reject := args[1]
		go func() {
			defer handler.Release()
			v, err := fn()
			if err != nil {
				reject.Invoke(js.ValueOf(err.Error()))
				return
			}
			resolve.Invoke(v)
		}()
		return nil
	})
	return js.Global().Get("Promise").New(handler)
}

func openArchive(_ js.Value, args []js.Value) any {
	return promiseOf(func() (js.Value, error) {
		if len(args) < 1 {
			return js.Undefined(), fmt.Errorf("openArchive requires Uint8Array")
		}
		data := jsBytesFromUint8Array(args[0])
		r, err := pfs.OpenReaderFromBytes(data)
		if err != nil {
			return js.Undefined(), err
		}
		h := register(r)
		entries := r.Entries()
		out := make([]entryJSON, len(entries))
		for i, e := range entries {
			out[i] = entryJSON{Name: e.Name, Offset: e.Offset, Size: e.Size}
		}
		raw, err := json.Marshal(map[string]any{
			"handle":  h,
			"format":  int(r.Format()),
			"entries": out,
		})
		if err != nil {
			remove(h)
			return js.Undefined(), err
		}
		return js.Global().Get("JSON").Call("parse", string(raw)), nil
	})
}

func listEntries(_ js.Value, args []js.Value) any {
	return promiseOf(func() (js.Value, error) {
		if len(args) < 1 {
			return js.Undefined(), fmt.Errorf("listEntries requires handle")
		}
		r, ok := getReader(int64(args[0].Int()))
		if !ok {
			return js.Undefined(), fmt.Errorf("invalid handle")
		}
		entries := r.Entries()
		out := make([]entryJSON, len(entries))
		for i, e := range entries {
			out[i] = entryJSON{Name: e.Name, Offset: e.Offset, Size: e.Size}
		}
		raw, err := json.Marshal(out)
		if err != nil {
			return js.Undefined(), err
		}
		return js.Global().Get("JSON").Call("parse", string(raw)), nil
	})
}

func extractEntry(_ js.Value, args []js.Value) any {
	return promiseOf(func() (js.Value, error) {
		if len(args) < 2 {
			return js.Undefined(), fmt.Errorf("extractEntry requires handle and index")
		}
		r, ok := getReader(int64(args[0].Int()))
		if !ok {
			return js.Undefined(), fmt.Errorf("invalid handle")
		}
		idx := args[1].Int()
		entries := r.Entries()
		if idx < 0 || idx >= len(entries) {
			return js.Undefined(), fmt.Errorf("entry index out of range")
		}
		data, err := r.ReadEntry(&entries[idx])
		if err != nil {
			return js.Undefined(), err
		}
		return jsUint8ArrayFromBytes(data), nil
	})
}

func extractAll(_ js.Value, args []js.Value) any {
	return promiseOf(func() (js.Value, error) {
		if len(args) < 1 {
			return js.Undefined(), fmt.Errorf("extractAll requires handle")
		}
		r, ok := getReader(int64(args[0].Int()))
		if !ok {
			return js.Undefined(), fmt.Errorf("invalid handle")
		}
		entries := r.Entries()
		result := js.Global().Get("Array").New(len(entries))
		total := len(entries)
		if pfs.OnProgress != nil {
			pfs.OnProgress(0, total)
		}
		for i := range entries {
			data, err := r.ReadEntry(&entries[i])
			if err != nil {
				return js.Undefined(), err
			}
			item := js.Global().Get("Object").New()
			item.Set("name", entries[i].Name)
			item.Set("data", jsUint8ArrayFromBytes(data))
			result.SetIndex(i, item)
			if pfs.OnProgress != nil {
				pfs.OnProgress(i+1, total)
			}
		}
		return result, nil
	})
}

func createArchive(_ js.Value, args []js.Value) any {
	return promiseOf(func() (js.Value, error) {
		if len(args) < 1 {
			return js.Undefined(), fmt.Errorf("createArchive requires files array")
		}
		files := args[0]
		n := files.Length()
		sources := make([]pfs.MemorySource, 0, n)
		for i := 0; i < n; i++ {
			f := files.Index(i)
			name := f.Get("name").String()
			data := jsBytesFromUint8Array(f.Get("data"))
			sources = append(sources, pfs.MemorySource{
				ArchivePath: pfs.OSToPF8Path(name),
				Data:        data,
			})
		}
		out, err := pfs.PackBytes(sources)
		if err != nil {
			return js.Undefined(), err
		}
		return jsUint8ArrayFromBytes(out), nil
	})
}

func closeArchive(_ js.Value, args []js.Value) any {
	if len(args) >= 1 {
		remove(int64(args[0].Int()))
	}
	return nil
}

func getProgress(_ js.Value, _ []js.Value) any {
	return atomic.LoadInt32(&globalProgress)
}

// decodeBase64 is a small helper for debugging from the browser console.
func decodeBase64(_ js.Value, args []js.Value) any {
	if len(args) < 1 {
		return js.Null()
	}
	raw, err := base64.StdEncoding.DecodeString(args[0].String())
	if err != nil {
		return js.Null()
	}
	return jsUint8ArrayFromBytes(raw)
}

func main() {
	api := js.Global().Get("Object").New()
	api.Set("openArchive", js.FuncOf(openArchive))
	api.Set("listEntries", js.FuncOf(listEntries))
	api.Set("extractEntry", js.FuncOf(extractEntry))
	api.Set("extractAll", js.FuncOf(extractAll))
	api.Set("createArchive", js.FuncOf(createArchive))
	api.Set("closeArchive", js.FuncOf(closeArchive))
	api.Set("getProgress", js.FuncOf(getProgress))
	api.Set("decodeBase64", js.FuncOf(decodeBase64))
	api.Set("ready", true)
	js.Global().Set("ArtemisPFS", api)

	// Keep the Go runtime alive.
	select {}
}
