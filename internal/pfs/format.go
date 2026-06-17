package pfs

import (
	"encoding/binary"
	"errors"
	"io"
)

// Archive format variants.
type Format int

const (
	FormatPF6 Format = 6
	FormatPF8 Format = 8
)

// Binary layout offsets relative to the archive start.
const (
	offMagic       = 0x00
	offIndexSize   = 0x03
	offIndexCount  = 0x07
	offEntries     = 0x0B
)

var magicPF6 = []byte("pf6")
var magicPF8 = []byte("pf8")

// Entry describes one file record stored in the PFS index.
type Entry struct {
	Name   string
	Offset uint32
	Size   uint32
}

// ReadMagic reads the 3-byte magic and returns the detected format.
func ReadMagic(r io.ReaderAt) (Format, error) {
	buf := make([]byte, 3)
	if _, err := r.ReadAt(buf, offMagic); err != nil {
		return 0, err
	}
	switch {
	case string(buf) == "pf6":
		return FormatPF6, nil
	case string(buf) == "pf8":
		return FormatPF8, nil
	default:
		return 0, ErrInvalidMagic
	}
}

// ReadUint32LE reads a little-endian uint32 at off from r.
func ReadUint32LE(r io.ReaderAt, off int64) (uint32, error) {
	buf := make([]byte, 4)
	if _, err := r.ReadAt(buf, off); err != nil {
		return 0, err
	}
	return binary.LittleEndian.Uint32(buf), nil
}

// HeaderSize returns the byte size of the complete index region starting at 0x07.
func HeaderSize(r io.ReaderAt) (int, error) {
	v, err := ReadUint32LE(r, offIndexSize)
	if err != nil {
		return 0, err
	}
	return int(v), nil
}

// ParseEntries reads the index region and returns parsed entries and the archive format.
func ParseEntries(r io.ReaderAt) (Format, []Entry, error) {
	fmt, err := ReadMagic(r)
	if err != nil {
		return 0, nil, err
	}
	idxSize, err := ReadUint32LE(r, offIndexSize)
	if err != nil {
		return 0, nil, err
	}
	// index data starts at 0x07, length = idxSize
	idxBuf := make([]byte, int(idxSize))
	if _, err := r.ReadAt(idxBuf, offIndexCount); err != nil {
		return 0, nil, err
	}

	count := int(binary.LittleEndian.Uint32(idxBuf[0:4]))
	cursor := 4
	entries := make([]Entry, 0, count)
	for i := 0; i < count; i++ {
		if cursor+4 > len(idxBuf) {
			return 0, nil, errors.New("pfs: truncated entry name_length")
		}
		nameLen := int(binary.LittleEndian.Uint32(idxBuf[cursor : cursor+4]))
		cursor += 4
		if cursor+nameLen > len(idxBuf) {
			return 0, nil, errors.New("pfs: truncated entry name")
		}
		name := decodeFilename(idxBuf[cursor : cursor+nameLen])
		cursor += nameLen
		// 4 reserved zero bytes
		cursor += 4
		if cursor+8 > len(idxBuf) {
			return 0, nil, errors.New("pfs: truncated entry offset/size")
		}
		offset := binary.LittleEndian.Uint32(idxBuf[cursor : cursor+4])
		size := binary.LittleEndian.Uint32(idxBuf[cursor+4 : cursor+8])
		cursor += 8
		entries = append(entries, Entry{Name: name, Offset: offset, Size: size})
	}

	return fmt, entries, nil
}
