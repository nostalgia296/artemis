package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/nostalgia296/artemis/internal/pfs"
)

// Handle registry: maps int64 handles to open Readers.
var (
	mu      sync.Mutex
	handles = make(map[int64]*pfs.Reader)
	nextH   int64 = 1
)

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
	delete(handles, h)
}

//export PFS_Open
func PFS_Open(cPath *C.char) (ret C.long) {
	defer func() {
		if r := recover(); r != nil {
			ret = -4
		}
	}()
	path := C.GoString(cPath)
	r, err := pfs.OpenReader(path)
	if err != nil {
		var pErr *pfs.Error
		if errors.As(err, &pErr) {
			switch pErr.Op {
			case "open":
				return -1
			case "parse":
				return -2
			}
		}
		return -4
	}
	h := register(r)
	return C.long(h)
}

//export PFS_ListEntries
func PFS_ListEntries(handle C.long) (ret *C.char) {
	defer func() {
		if r := recover(); r != nil {
			ret = C.CString("[]")
		}
	}()
	r, ok := getReader(int64(handle))
	if !ok {
		return C.CString("[]")
	}
	type entryJSON struct {
		Name   string `json:"name"`
		Offset uint32 `json:"offset"`
		Size   uint32 `json:"size"`
	}
	entries := r.Entries()
	out := make([]entryJSON, len(entries))
	for i, e := range entries {
		out[i] = entryJSON{Name: e.Name, Offset: e.Offset, Size: e.Size}
	}
	data, _ := json.Marshal(out)
	return C.CString(string(data))
}

//export PFS_Extract
func PFS_Extract(handle C.long, cDest *C.char) (ret C.int) {
	defer func() {
		if r := recover(); r != nil {
			ret = -4
		}
	}()
	r, ok := getReader(int64(handle))
	if !ok {
		return -4
	}
	dest := C.GoString(cDest)
	if err := r.ExtractAll(dest); err != nil {
		return -3
	}
	return 0
}

//export PFS_Create
func PFS_Create(cSrcDir *C.char, cOutPath *C.char) (ret C.int) {
	defer func() {
		if r := recover(); r != nil {
			ret = -3
		}
	}()
	srcDir := C.GoString(cSrcDir)
	outPath := C.GoString(cOutPath)

	var sources []pfs.Source
	err := filepath.WalkDir(srcDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, relErr := filepath.Rel(srcDir, path)
		if relErr != nil {
			return relErr
		}
		archivePath := pfs.OSToPF8Path(rel)
		sources = append(sources, pfs.Source{SourcePath: path, ArchivePath: archivePath})
		return nil
	})
	if err != nil {
		return -3
	}
	if err := pfs.Pack(outPath, sources); err != nil {
		return -3
	}
	return 0
}

//export PFS_Close
func PFS_Close(handle C.long) {
	defer func() { recover() }()
	r, ok := getReader(int64(handle))
	if ok {
		r.Close()
		remove(int64(handle))
	}
}

func main() {}
