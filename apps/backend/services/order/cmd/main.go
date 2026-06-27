package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/order/config"
	"github.com/suqafuran/express/services/order/internal/handler"
	"github.com/suqafuran/express/services/order/internal/repository"
	"github.com/suqafuran/express/shared/middleware"
	"github.com/suqafuran/express/shared/pkg"
)

func init() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
}

func main() {
	cfg := config.Load()

	log.Info().
		Int("port", cfg.Port).
		Str("database", cfg.DBConnStr).
		Str("nats", cfg.NatsURL).
		Msg("Starting Order Service")

	// Database connection pool
	dbConfig, err := pgxpool.ParseConfig(cfg.DBConnStr)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to parse database config")
	}
	dbConfig.MaxConns = 25
	dbConfig.MinConns = 5
	dbConfig.MaxConnLifetime = 1 * time.Hour
	dbConfig.MaxConnIdleTime = 30 * time.Minute

	db, err := pgxpool.NewWithConfig(context.Background(), dbConfig)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer db.Close()

	if err := db.Ping(context.Background()); err != nil {
		log.Fatal().Err(err).Msg("Database ping failed")
	}
	log.Info().Msg("Database connected")

	// NATS connection
	nc, err := nats.Connect(cfg.NatsURL)
	if err != nil {
		log.Warn().Err(err).Msg("NATS connection failed, running without event bus (will retry)")
		// Don't fail on NATS, allow graceful degradation
		nc = nil
	} else {
		defer nc.Close()
		log.Info().Msg("NATS connected")
	}

	// Initialize repositories
	orderRepo := repository.NewPostgresOrderRepository(db)

	// Initialize handler
	orderHandler := handler.NewHandler(db, orderRepo, nc)

	// JWT manager
	jwtMgr := pkg.NewJWTManager(cfg.JWTSecret)

	// Gin router
	r := gin.Default()

	// Health checks
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, pkg.HealthResponse{
			Status:  "healthy",
			Message: "Order service is running",
		})
	})

	r.GET("/ready", func(c *gin.Context) {
		if err := db.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, pkg.ReadyResponse{
				Ready: false,
				Details: map[string]string{
					"database": "unreachable",
				},
			})
			return
		}

		details := map[string]string{"database": "ok"}
		if nc != nil && nc.Status() == nats.CONNECTED {
			details["nats"] = "ok"
		} else {
			details["nats"] = "disconnected"
		}

		c.JSON(http.StatusOK, pkg.ReadyResponse{
			Ready:   true,
			Details: details,
		})
	})

	// Order routes
	orders := r.Group("/v1/orders")
	orders.Use(middleware.JWTAuth(jwtMgr))
	{
		orders.POST("", orderHandler.CreateOrderHandler)
		orders.GET("", orderHandler.ListOrdersHandler)
		orders.GET("/:id", orderHandler.GetOrderHandler)
		orders.PATCH("/:id/status", orderHandler.UpdateOrderStatusHandler)
		orders.POST("/:id/rate", orderHandler.RateDeliveryHandler)
	}

	// HTTP server with graceful shutdown
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Msgf("Order Service listening on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server error")
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutting down Order Service")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Shutdown error")
	}

	if nc != nil {
		nc.Close()
	}
	db.Close()

	log.Info().Msg("Order Service stopped")
}
