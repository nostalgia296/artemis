package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/nostalgia296/artemis/internal/pfs"
)

func TestHandleRegistry(t *testing.T) {
	// Create a minimal test archive
	tmp := t.TempDir()
	archivePath := filepath.Join(tmp, "test.pfs")

	// Create a source file
	srcFile := filepath.Join(tmp, "hello.txt")
	os.WriteFile(srcFile, []byte("hello world"), 0644)

	sources := []pfs.Source{
		{SourcePath: srcFile, ArchivePath: "hello.txt"},
	}
	if err := pfs.Pack(archivePath, sources); err != nil {
		t.Fatalf("Pack failed: %v", err)
	}

	// Test open -- returns handle (positive) or -1 on error
	handle := GoPFS_Open(archivePath)
	if handle < 0 {
		t.Fatalf("PFS_Open failed with handle %d", handle)
	}

	// Test list
	goStr := GoPFS_ListEntries(handle)
	if len(goStr) == 0 {
		t.Fatal("expected non-empty JSON")
	}

	// Verify JSON is valid and contains expected entry
	entries, err := ParseEntriesJSON(goStr)
	if err != nil {
		t.Fatalf("invalid JSON: %v\nraw: %s", err, goStr)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].Name != "hello.txt" {
		t.Errorf("entry name = %q, want %q", entries[0].Name, "hello.txt")
	}
	if entries[0].Size != 11 {
		t.Errorf("entry size = %d, want 11", entries[0].Size)
	}

	// Test extract
	extractDir := filepath.Join(tmp, "out")
	os.MkdirAll(extractDir, 0755)
	rc := GoPFS_Extract(handle, extractDir)
	if rc != 0 {
		t.Fatalf("PFS_Extract returned %d, want 0", rc)
	}
	extracted, err := os.ReadFile(filepath.Join(extractDir, "hello.txt"))
	if err != nil {
		t.Fatalf("read extracted file: %v", err)
	}
	if string(extracted) != "hello world" {
		t.Errorf("extracted content = %q, want %q", extracted, "hello world")
	}

	// Test close
	GoPFS_Close(handle)

	// After close, listEntries should return "[]" for invalid handle
	goStr2 := GoPFS_ListEntries(handle)
	if goStr2 != "[]" {
		t.Errorf("after close, list = %q, want %q", goStr2, "[]")
	}
}

func TestPFS_OpenInvalidPath(t *testing.T) {
	handle := GoPFS_Open("/nonexistent/path.pfs")
	if handle != -1 {
		t.Errorf("PFS_Open with invalid path returned %d, want -1", handle)
	}
}

func TestPFS_ExtractInvalidHandle(t *testing.T) {
	rc := GoPFS_Extract(99999, "/tmp")
	if rc != -4 {
		t.Errorf("PFS_Extract with invalid handle returned %d, want -4", rc)
	}
}

func TestPFS_ListEntriesInvalidHandle(t *testing.T) {
	goStr := GoPFS_ListEntries(99999)
	if goStr != "[]" {
		t.Errorf("PFS_ListEntries with invalid handle returned %q, want %q", goStr, "[]")
	}
}

func TestPFS_CreateAndRoundTrip(t *testing.T) {
	tmp := t.TempDir()

	// Create source directory with files
	srcDir := filepath.Join(tmp, "mydata")
	os.MkdirAll(filepath.Join(srcDir, "sub"), 0755)
	os.WriteFile(filepath.Join(srcDir, "a.txt"), []byte("aaa"), 0644)
	os.WriteFile(filepath.Join(srcDir, "sub", "b.txt"), []byte("bbb"), 0644)

	outPath := filepath.Join(tmp, "out.pfs")
	rc := GoPFS_Create(srcDir, outPath)
	if rc != 0 {
		t.Fatalf("PFS_Create returned %d, want 0", rc)
	}

	// Verify we can open and list the created archive
	handle := GoPFS_Open(outPath)
	if handle < 0 {
		t.Fatalf("PFS_Open on created archive failed with handle %d", handle)
	}

	goStr := GoPFS_ListEntries(handle)
	entries, err := ParseEntriesJSON(goStr)
	if err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d (json: %s)", len(entries), goStr)
	}

	GoPFS_Close(handle)
}
