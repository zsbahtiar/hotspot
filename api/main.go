package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	httpSwagger "github.com/swaggo/http-swagger/v2"
	"github.com/zsbahtiar/hotspot/api/config"
	"github.com/zsbahtiar/hotspot/api/database"
	_ "github.com/zsbahtiar/hotspot/api/docs"
	"github.com/zsbahtiar/hotspot/api/internal/repository/clickhouse"
	"github.com/zsbahtiar/hotspot/api/internal/rest"
	"github.com/zsbahtiar/hotspot/api/service"
)

// @title			Hotspot API
// @version		1.0
// @description	REST API for Indonesia wildfire hotspot analytics (detections, GeoJSON, summary, drill-down locations and periods).
// @BasePath		/
func main() {
	cfg := config.Load()
	config.SetupLogging(cfg.Env)

	chConn, err := database.SetupClickhouse(cfg.ClickHouse)
	if err != nil {
		slog.Error("failed to connect to ClickHouse", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer chConn.Close()

	redisClient, err := database.SetupRedis(cfg.Redis)
	if err != nil {
		slog.Error("failed to connect to Redis", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer redisClient.Close()

	hotspotRepo := clickhouse.NewHotspotRepository(chConn)
	hotspotService := service.NewHotspotService(hotspotRepo, redisClient)

	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORS.AllowedOrigins,
		AllowedMethods:   cfg.CORS.AllowedMethods,
		AllowedHeaders:   cfg.CORS.AllowedHeaders,
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           cfg.CORS.MaxAge,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		chStatus := "disconnected"
		if err := hotspotRepo.Ping(); err == nil {
			chStatus = "connected"
		}

		response := struct {
			Status     string `json:"status"`
			ClickHouse string `json:"clickhouse"`
		}{
			Status:     "ok",
			ClickHouse: chStatus,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})

	if cfg.EnableSwagger {
		r.Get("/swagger/*", httpSwagger.WrapHandler)
		slog.Info("swagger UI enabled", slog.String("path", "/swagger/index.html"))
	}

	apiV1 := chi.NewRouter()
	apiV1.Use(middleware.Logger)
	apiV1.Use(middleware.Recoverer)
	apiV1.Use(middleware.URLFormat)
	apiV1.Use(middleware.AllowContentType("application/json"))

	rest.NewHotspotHandler(apiV1, hotspotService)

	r.Mount("/api/v1", apiV1)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Server.Port),
		Handler: r,
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGHUP, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)

	go func() {
		slog.Info("server starting", slog.String("port", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("error starting server", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	<-sig
	slog.Info("server shutdown initiated")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server shutdown failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	slog.Info("server gracefully stopped")
}
