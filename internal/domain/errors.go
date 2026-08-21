package domain

import "errors"

// Errors the whole application agrees on. Transport maps these to status
// codes; storage and services return them rather than inventing their own, so
// a "not found" means the same thing at every layer.
var (
	ErrNotFound      = errors.New("not found")
	ErrInvalidInput  = errors.New("invalid input")
	ErrUnauthorized  = errors.New("not authorized")
	ErrQueueFull     = errors.New("queue is full")
	ErrAlreadyExists = errors.New("already exists")
)
