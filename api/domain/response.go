package domain

type Response[T any] struct {
	Message string `json:"message"`
	Success bool   `json:"success"`
	Data    T      `json:"data"`
}

type ErrorResponse struct {
	Message string `json:"message"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func NewResponse[T any](message string, data T) Response[T] {
	return Response[T]{
		Message: message,
		Success: true,
		Data:    data,
	}
}
