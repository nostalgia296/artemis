package pfs

import (
	"path/filepath"
	"strings"

	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/transform"
)

// decodeFilename tries UTF-8 first, then Shift-JIS (CP932).
func decodeFilename(raw []byte) string {
	if s := strings.ToValidUTF8(string(raw), ""); s != "" {
		return s
	}
	dec := japanese.ShiftJIS.NewDecoder()
	out, _, _ := transform.Bytes(dec, raw)
	return string(out)
}

// encodeFilename encodes the filename to bytes (UTF-8).
func encodeFilename(s string) []byte {
	return []byte(s)
}

// PF8PathToOS converts a PF8 backslash path to a platform path.
func PF8PathToOS(p string) string {
	parts := strings.Split(p, "\\")
	return filepath.Join(parts...)
}

// OSToPF8Path converts a platform path to PF8 backslash format.
func OSToPF8Path(p string) string {
	parts := strings.Split(filepath.ToSlash(p), "/")
	return strings.Join(parts, "\\")
}
