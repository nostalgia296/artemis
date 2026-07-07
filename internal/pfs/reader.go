package pfs

import (
	"context"
	"fmt"
	"io"
	"os"
)

const bufferSize = 4 * 1024 * 1024 // 4 MiB

// Reader opens a PFS archive for reading.
type Reader struct {
	f       *os.File
	format  Format
	entries []Entry
	key     []byte // nil for PF6
}

// OpenReader opens the archive at path and parses its index.
func OpenReader(path string) (*Reader, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, &Error{"open", err}
	}
	fmt_, entries, err := ParseEntries(f)
	if err != nil {
		f.Close()
		return nil, &Error{"parse", err}
	}
	r := &Reader{f: f, format: fmt_, entries: entries}
	if fmt_.IsPF8() {
		hsz, err := HeaderSize(f)
		if err != nil {
			f.Close()
			return nil, &Error{"header_size", err}
		}
		idxBuf := make([]byte, hsz)
		if _, err := f.ReadAt(idxBuf, offIndexCount); err != nil {
			f.Close()
			return nil, &Error{"read_index", err}
		}
		key := GenerateKey(idxBuf)
		r.key = key[:]
	}
	return r, nil
}

// Format returns the detected archive format.
func (r *Reader) Format() Format { return r.format }

// Entries returns the parsed file entries.
func (r *Reader) Entries() []Entry { return r.entries }

// Close closes the underlying file.
func (r *Reader) Close() error { return r.f.Close() }

// List writes a summary of entries to w.
func (r *Reader) List(w io.Writer, long bool) {
	for _, e := range r.entries {
		if long {
			fmt.Fprintf(w, "%8d  %s\n", e.Size, PF8PathToOS(e.Name))
		} else {
			fmt.Fprintln(w, PF8PathToOS(e.Name))
		}
	}
}

// ExtractAll extracts every entry into dst.
func (r *Reader) ExtractAll(dst string) error {
	return r.ExtractAllContext(context.Background(), dst)
}

// ExtractAllContext extracts every entry into dst and stops when ctx is canceled.
func (r *Reader) ExtractAllContext(ctx context.Context, dst string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	for i := range r.entries {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := r.extractOneContext(ctx, dst, &r.entries[i]); err != nil {
			return err
		}
	}
	return nil
}

func (r *Reader) extractOneContext(ctx context.Context, dst string, e *Entry) error {
	outPath := PF8PathToOS(e.Name)
	if dst != "" {
		outPath = dst + "/" + outPath
	}
	if err := os.MkdirAll(dirOf(outPath), 0o755); err != nil {
		return &Error{"mkdir", err}
	}
	outFile, err := os.Create(outPath)
	if err != nil {
		return &Error{"create", err}
	}
	defer outFile.Close()

	needCipher := r.key != nil && !IsUnencryptedPath(e.Name)
	buf := make([]byte, bufferSize)
	remaining := int64(e.Size)
	offset := int64(e.Offset)
	var logical int64

	for remaining > 0 {
		if err := ctx.Err(); err != nil {
			return err
		}
		chunk := int64(bufferSize)
		if chunk > remaining {
			chunk = remaining
		}
		if _, err := r.f.ReadAt(buf[:chunk], offset); err != nil {
			return &Error{"read_data", err}
		}
		if needCipher {
			ApplyCipher(buf[:chunk], r.key, int(logical))
		}
		if _, err := outFile.Write(buf[:chunk]); err != nil {
			return &Error{"write_file", err}
		}
		offset += chunk
		logical += chunk
		remaining -= chunk
	}
	return nil
}

// dirOf returns the directory portion of a path.
func dirOf(p string) string {
	for i := len(p) - 1; i >= 0; i-- {
		if p[i] == '/' {
			return p[:i]
		}
	}
	return "."
}
