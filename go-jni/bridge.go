package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"context"
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
	handles       = make(map[int64]*pfs.Reader)
	nextH   int64 = 1

	taskMu      sync.Mutex
	currentTask *taskControl
)

type taskControl struct {
	cancel context.CancelFunc
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
	delete(handles, h)
}

func beginTask() (context.Context, *taskControl) {
	ctx, cancel := context.WithCancel(context.Background())
	task := &taskControl{cancel: cancel}
	taskMu.Lock()
	if currentTask != nil {
		currentTask.cancel()
	}
	currentTask = task
	taskMu.Unlock()
	return ctx, task
}

func endTask(task *taskControl) {
	taskMu.Lock()
	if currentTask == task {
		currentTask = nil
	}
	taskMu.Unlock()
	task.cancel()
}

//export PFS_CancelCurrentTask
func PFS_CancelCurrentTask() {
	taskMu.Lock()
	task := currentTask
	taskMu.Unlock()
	if task != nil {
		task.cancel()
	}
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
	ctx, cancel := beginTask()
	defer endTask(cancel)
	dest := C.GoString(cDest)
	if err := r.ExtractAllContext(ctx, dest); err != nil {
		if errors.Is(err, context.Canceled) {
			return -5
		}
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
	ctx, cancel := beginTask()
	defer endTask(cancel)

	var sources []pfs.Source
	err := filepath.WalkDir(srcDir, func(path string, d os.DirEntry, err error) error {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ctxErr
		}
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
		if errors.Is(err, context.Canceled) {
			return -5
		}
		return -3
	}
	if err := pfs.PackContext(ctx, outPath, sources); err != nil {
		if errors.Is(err, context.Canceled) {
			return -5
		}
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
