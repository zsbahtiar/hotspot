package logging

import (
	"context"
	"log/slog"
)

func LogError(ctx context.Context, err error, op string) {
	if err == nil {
		return
	}
	slog.ErrorContext(ctx, op, slog.String("error", err.Error()))
}

func LogInfo(ctx context.Context, msg string, attrs ...slog.Attr) {
	slog.LogAttrs(ctx, slog.LevelInfo, msg, attrs...)
}
