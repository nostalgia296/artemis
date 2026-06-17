package pfs

import (
	"errors"
	"fmt"
)

var (
	ErrInvalidMagic = errors.New("pfs: invalid magic")
	ErrCorrupted    = errors.New("pfs: corrupted archive")
)

type Error struct {
	Op  string
	Err error
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("pfs: %s: %v", e.Op, e.Err)
}

func (e *Error) Unwrap() error { return e.Err }
