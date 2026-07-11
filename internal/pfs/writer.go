package pfs

import (
	"bytes"
	"context"
	"encoding/binary"
	"io"
	"os"
)

// Source maps a local file path to its in-archive path.
type Source struct {
	SourcePath  string
	ArchivePath string
}

type fileEntry struct {
	src  string
	name string
	size uint32
}

// Pack creates a PF8 archive at outPath from the given sources.
func Pack(outPath string, sources []Source) error {
	return PackContext(context.Background(), outPath, sources)
}

// PackContext creates a PF8 archive at outPath and stops when ctx is canceled.
func PackContext(ctx context.Context, outPath string, sources []Source) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	entries := make([]fileEntry, 0, len(sources))
	for _, s := range sources {
		if err := ctx.Err(); err != nil {
			return err
		}
		info, err := os.Stat(s.SourcePath)
		if err != nil {
			return &Error{"stat", err}
		}
		entries = append(entries, fileEntry{src: s.SourcePath, name: s.ArchivePath, size: uint32(info.Size())})
	}

	// Two-pass build: first with dummy offsets to measure index size,
	// then with real absolute offsets once we know where the data area starts.
	// Header = magic(3) + index_size(4) + indexBuf.
	indexBuf := buildIndex(entries, 0)
	headerSize := uint32(3 + 4 + len(indexBuf)) // 0x0B + indexBuf = absolute offset of data area
	indexBuf = buildIndex(entries, headerSize)
	indexSize := uint32(len(indexBuf))
	key := GenerateKey(indexBuf)

	f, err := os.Create(outPath)
	if err != nil {
		return &Error{"create", err}
	}
	defer f.Close()

	if _, err := f.Write([]byte("pf8")); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, indexSize); err != nil {
		return err
	}
	if _, err := f.Write(indexBuf); err != nil {
		return err
	}

	total := len(entries)
	if OnProgress != nil {
		OnProgress(0, total)
	}
	for i, e := range entries {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := writeFileDataContext(ctx, f, e.src, e.name, e.size, key[:]); err != nil {
			return err
		}
		if OnProgress != nil {
			OnProgress(i+1, total)
		}
	}
	return nil
}

// buildIndex constructs the index buffer with dataOffsetBase added to each entry's offset.
func buildIndex(entries []fileEntry, dataOffsetBase uint32) []byte {
	var idx bytes.Buffer
	binary.Write(&idx, binary.LittleEndian, uint32(len(entries)))

	sizeFieldPositions := make([]uint64, len(entries))
	cursor := 4 // relative to 0x07
	var dataOff uint32
	for i, e := range entries {
		nameBytes := encodeFilename(e.name)
		binary.Write(&idx, binary.LittleEndian, uint32(len(nameBytes)))
		idx.Write(nameBytes)
		idx.Write([]byte{0, 0, 0, 0})
		binary.Write(&idx, binary.LittleEndian, dataOffsetBase+dataOff)
		sizeFieldPositions[i] = uint64(cursor + 4 + len(nameBytes) + 4 + 4)
		binary.Write(&idx, binary.LittleEndian, e.size)
		cursor += 4 + len(nameBytes) + 4 + 4 + 4
		dataOff += e.size
	}

	binary.Write(&idx, binary.LittleEndian, uint32(len(entries)+1)) // filesize_count
	for _, pos := range sizeFieldPositions {
		binary.Write(&idx, binary.LittleEndian, pos)
	}
	idx.Write(make([]byte, 8)) // zero terminator
	binary.Write(&idx, binary.LittleEndian, uint32(cursor))

	return idx.Bytes()
}

func writeFileDataContext(ctx context.Context, dst *os.File, srcPath, archiveName string, size uint32, key []byte) error {
	src, err := os.Open(srcPath)
	if err != nil {
		return &Error{"open_src", err}
	}
	defer src.Close()

	needCipher := !IsUnencryptedPath(archiveName)
	buf := make([]byte, bufferSize)
	var written uint32

	for written < size {
		if err := ctx.Err(); err != nil {
			return err
		}
		toRead := bufferSize
		remaining := size - written
		if uint32(toRead) > remaining {
			toRead = int(remaining)
		}
		n, err := io.ReadFull(src, buf[:toRead])
		if err != nil {
			return &Error{"read_src", err}
		}
		if needCipher {
			ApplyCipher(buf[:n], key, int(written))
		}
		if _, err := dst.Write(buf[:n]); err != nil {
			return &Error{"write_data", err}
		}
		written += uint32(n)
	}
	return nil
}
