package pfs

import (
	"crypto/sha1"
	"path/filepath"
	"strings"
)

// GenerateKey derives the 20-byte XOR key for PF8 from the index region.
// indexData must be the bytes at [0x07, 0x07+indexSize).
func GenerateKey(indexData []byte) [20]byte {
	return sha1.Sum(indexData)
}

// ApplyCipher XORs data in-place with the cyclic key, starting at logical offset.
func ApplyCipher(data []byte, key []byte, offset int) {
	if len(key) == 0 {
		return
	}
	for i := range data {
		data[i] ^= key[(offset+i)%len(key)]
	}
}

// IsUnencryptedPath reports whether the archive path should skip PF8 encryption.
func IsUnencryptedPath(path string) bool {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(path), "."))
	return ext == "mp4" || ext == "flv"
}

// IsPF6 reports whether the archive format is PF6.
func (f Format) IsPF6() bool { return f == FormatPF6 }

// IsPF8 reports whether the archive format is PF8.
func (f Format) IsPF8() bool { return f == FormatPF8 }
