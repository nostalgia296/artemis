package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/nostalgia296/artemis/internal/pfs"
)

const usage = `pfs - Artemis PFS archive tool

Usage:
  pfs list    <archives...> [--long]  List contents (supports multiple archives)
  pfs extract <archives...> [dest]    Extract archives to dest (default: .)
  pfs create  <dir> [-o output.pfs] Pack directory into archive

Examples:
  pfs list root.pfs
  pfs list pfs.001 pfs.002 pfs.003 --long
  pfs extract root.pfs output/
  pfs extract pfs.001 pfs.002 pfs.003 output/
  pfs create game/ -o root.pfs
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(1)
	}

	cmd := os.Args[1]
	switch cmd {
	case "list":
		cmdList(os.Args[2:])
	case "extract":
		cmdExtract(os.Args[2:])
	case "create":
		cmdCreate(os.Args[2:])
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n", cmd)
		fmt.Fprint(os.Stderr, usage)
		os.Exit(1)
	}
}

func cmdList(args []string) {
	var archives []string
	long := false
	for _, a := range args {
		if a == "--long" {
			long = true
		} else {
			archives = append(archives, a)
		}
	}
	if len(archives) == 0 {
		fmt.Fprintln(os.Stderr, "usage: pfs list <archives...> [--long]")
		os.Exit(1)
	}
	for _, archive := range archives {
		r, err := pfs.OpenReader(archive)
		if err != nil {
			fatal(err)
		}
		if len(archives) > 1 {
			fmt.Fprintf(os.Stderr, "[%s] PF%d, %d entries\n", filepath.Base(archive), r.Format(), len(r.Entries()))
		}
		r.List(os.Stdout, long)
		r.Close()
	}
}

func cmdExtract(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "usage: pfs extract <archives...> [dest]")
		os.Exit(1)
	}
	// Last arg is dest if it doesn't look like an archive and there are 2+ args.
	archives := args
	dest := "."
	if len(args) > 1 {
		// Treat the last arg as dest if it's a directory or doesn't exist yet.
		last := args[len(args)-1]
		info, err := os.Stat(last)
		if err != nil || info.IsDir() {
			dest = last
			archives = args[:len(args)-1]
		}
	}
	for _, archive := range archives {
		r, err := pfs.OpenReader(archive)
		if err != nil {
			fatal(err)
		}
		fmt.Fprintf(os.Stderr, "extracting %s (%d entries) to %s\n", filepath.Base(archive), len(r.Entries()), dest)
		if err := r.ExtractAll(dest); err != nil {
			r.Close()
			fatal(err)
		}
		r.Close()
	}
	fmt.Fprintln(os.Stderr, "done")
}

func cmdCreate(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "usage: pfs create <dir> [-o output.pfs]")
		os.Exit(1)
	}

	var dirs []string
	output := "root.pfs"
	for i := 0; i < len(args); i++ {
		switch {
		case args[i] == "-o" && i+1 < len(args):
			i++
			output = args[i]
		default:
			dirs = append(dirs, args[i])
		}
	}
	if len(dirs) == 0 {
		fmt.Fprintln(os.Stderr, "error: no input directories specified")
		os.Exit(1)
	}

	var sources []pfs.Source
	for _, dir := range dirs {
		base := filepath.Base(dir)
		err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				return nil
			}
			rel, _ := filepath.Rel(dir, path)
			// Use the top-level dir name as prefix: e.g. "script\\main.s"
			archivePath := pfs.OSToPF8Path(filepath.Join(base, rel))
			// Strip leading dir if rel starts with base already
			archivePath = strings.ReplaceAll(archivePath, "/", "\\")
			sources = append(sources, pfs.Source{
				SourcePath:  path,
				ArchivePath: archivePath,
			})
			return nil
		})
		if err != nil {
			fatal(err)
		}
	}

	fmt.Fprintf(os.Stderr, "packing %d files into %s\n", len(sources), output)
	if err := pfs.Pack(output, sources); err != nil {
		fatal(err)
	}
	fmt.Fprintln(os.Stderr, "done")
}

func fatal(err error) {
	fmt.Fprintf(os.Stderr, "error: %v\n", err)
	os.Exit(1)
}
