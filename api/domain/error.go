package domain

import "errors"

var (
	ErrInternal = errors.New("internal server error")

	ErrNotFound = errors.New("resource not found")

	ErrBadParamInput = errors.New("given param is not valid")
)
