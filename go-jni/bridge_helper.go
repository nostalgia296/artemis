package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"unsafe"
)

// GoPFS_Open wraps PFS_Open for use from Go (including tests).
func GoPFS_Open(path string) int64 {
	cPath := C.CString(path)
	defer C.free(unsafe.Pointer(cPath))
	return int64(PFS_Open(cPath))
}

// GoPFS_ListEntries wraps PFS_ListEntries for use from Go.
func GoPFS_ListEntries(handle int64) string {
	cStr := PFS_ListEntries(C.long(handle))
	defer C.free(unsafe.Pointer(cStr))
	return C.GoString(cStr)
}

// GoPFS_Extract wraps PFS_Extract for use from Go.
func GoPFS_Extract(handle int64, dest string) int {
	cDest := C.CString(dest)
	defer C.free(unsafe.Pointer(cDest))
	return int(PFS_Extract(C.long(handle), cDest))
}

// GoPFS_Create wraps PFS_Create for use from Go.
func GoPFS_Create(srcDir, outPath string) int {
	cSrc := C.CString(srcDir)
	defer C.free(unsafe.Pointer(cSrc))
	cOut := C.CString(outPath)
	defer C.free(unsafe.Pointer(cOut))
	return int(PFS_Create(cSrc, cOut))
}

// GoPFS_Close wraps PFS_Close for use from Go.
func GoPFS_Close(handle int64) {
	PFS_Close(C.long(handle))
}

// ParseEntriesJSON is a helper to unmarshal the JSON entry list.
func ParseEntriesJSON(jsonStr string) ([]EntryInfo, error) {
	var entries []EntryInfo
	err := json.Unmarshal([]byte(jsonStr), &entries)
	return entries, err
}

// EntryInfo mirrors the JSON structure returned by PFS_ListEntries.
type EntryInfo struct {
	Name   string `json:"name"`
	Offset uint32 `json:"offset"`
	Size   uint32 `json:"size"`
}
