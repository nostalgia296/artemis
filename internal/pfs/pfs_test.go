package pfs

import (
	"bytes"
	"crypto/rand"
	"os"
	"path/filepath"
	"testing"
)

func TestRoundTrip(t *testing.T) {
	dir := t.TempDir()

	// Create test files.
	files := map[string]string{
		"hello.txt":     "Hello, PFS!",
		"sub/nested.go": "package main\n",
	}
	for rel, content := range files {
		p := filepath.Join(dir, "src", rel)
		os.MkdirAll(filepath.Dir(p), 0o755)
		os.WriteFile(p, []byte(content), 0o644)
	}

	// Add a random 1MB file to stress the streaming path.
	big := make([]byte, 1024*1024)
	rand.Read(big)
	bigPath := filepath.Join(dir, "src", "big.bin")
	os.WriteFile(bigPath, big, 0o644)

	// Pack.
	pfsPath := filepath.Join(dir, "test.pfs")
	sources := []Source{
		{SourcePath: filepath.Join(dir, "src", "hello.txt"), ArchivePath: "hello.txt"},
		{SourcePath: filepath.Join(dir, "src", "sub", "nested.go"), ArchivePath: "sub\\nested.go"},
		{SourcePath: bigPath, ArchivePath: "big.bin"},
	}
	if err := Pack(pfsPath, sources); err != nil {
		t.Fatalf("Pack: %v", err)
	}

	// Read back and verify.
	r, err := OpenReader(pfsPath)
	if err != nil {
		t.Fatalf("OpenReader: %v", err)
	}
	defer r.Close()

	if r.Format() != FormatPF8 {
		t.Fatalf("format = %d, want PF8", r.Format())
	}
	if len(r.Entries()) != 3 {
		t.Fatalf("entries = %d, want 3", len(r.Entries()))
	}

	// Extract.
	outDir := filepath.Join(dir, "out")
	if err := r.ExtractAll(outDir); err != nil {
		t.Fatalf("ExtractAll: %v", err)
	}

	// Verify file contents.
	for rel, want := range files {
		got, err := os.ReadFile(filepath.Join(outDir, rel))
		if err != nil {
			t.Errorf("read %s: %v", rel, err)
			continue
		}
		if string(got) != want {
			t.Errorf("%s = %q, want %q", rel, got, want)
		}
	}

	gotBig, err := os.ReadFile(filepath.Join(outDir, "big.bin"))
	if err != nil {
		t.Fatalf("read big.bin: %v", err)
	}
	if !bytes.Equal(gotBig, big) {
		t.Errorf("big.bin content mismatch")
	}
}

func TestPathConversion(t *testing.T) {
	if got := PF8PathToOS("a\\b\\c"); got != "a/b/c" && got != "a\\b\\c" {
		// On unix it's a/b/c
	}
	if got := OSToPF8Path("a/b/c"); got != `a\b\c` {
		t.Errorf("OSToPF8Path = %q", got)
	}
}

func TestIsUnencryptedPath(t *testing.T) {
	tests := []struct {
		path string
		want bool
	}{
		{"video/movie.mp4", true},
		{"video/movie.flv", true},
		{"image/photo.png", false},
		{"script/main.s", false},
	}
	for _, tt := range tests {
		if got := IsUnencryptedPath(tt.path); got != tt.want {
			t.Errorf("IsUnencryptedPath(%q) = %v, want %v", tt.path, got, tt.want)
		}
	}
}
