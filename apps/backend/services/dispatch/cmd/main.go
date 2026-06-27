package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nats-io/nats.go"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/dispatch/config"
	"github.com/suqafuran/express/services/dispatch/internal/handler"
	"github.com/suqafuran/express/services/dispatch/internal/repository"
	"github.com/suqafuran/express/services/dispatch/internal/service"
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
		Str("redis", cfg.RedisAddr).
		Str("nats", cfg.NatsURL).
		Msg("Starting Dispatch Service")

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

	// Redis connection
	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		PoolSize: 10,
	})
	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Fatal().Err(err).Msg("Redis ping failed")
	}
	log.Info().Msg("Redis connected")

	// NATS connection
	nc, err := nats.Connect(cfg.NatsURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to NATS")
	}
	defer nc.Close()
	log.Info().Msg("NATS connected")

	// Initialize repositories
	dispatchRepo := repository.NewPostgresDispatchRepository(db)

	// Initialize dispatch service
	dispatchSvc := service.NewDispatchService(dispatchRepo, redisClient, nc)

	// Subscribe to order.created events
	nc.Subscribe("order.created", func(m *nats.Msg) {
		var event service.OrderCreatedEvent
		if err := json.Unmarshal(m.Data, &event); err != nil {
			log.Error().Err(err).Msg("Failed to unmarshal order.created event")
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		if err := dispatchSvc.OnOrderCreated(ctx, event); err != nil {
			log.Error().Err(err).
				Str("order_id", event.OrderID.String()).
				Msg("Failed to process order.created event")
		}
		cancel()
	})

	log.Info().Msg("NATS subscribers initialized")

	// Initialize handler
	dispatchHandler := handler.NewHandler(db, dispatchRepo, dispatchSvc)

	// JWT manager
	jwtMgr := pkg.NewJWTManager(cfg.JWTSecret)

	// Gin router
	r := gin.Default()

	// Health checks
	r.GET("/health", dispatchHandler.HealthHandler)
	r.GET("/ready", dispatchHandler.ReadyHandler)

	// Dispatch routes (authenticated)
	dispatch := r.Group("/v1/dispatch")
	dispatch.Use(middleware.JWTAuth(jwtMgr))
	{
		dispatch.GET("/jobs/:id", dispatchHandler.GetDispatchJobHandler)
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
		log.Info().Msgf("Dispatch Service listening on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server error")
		}
	}()

	// Background job: Check for expired jobs every 10 seconds
	ticker := time.NewTicker(10 * time.Second)
	go func() {
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := dispatchSvc.CheckJobTimeouts(ctx); err != nil {
				log.Error().Err(err).Msg("Failed to check job timeouts")
			}
			cancel()
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutting down Dispatch Service")
	ticker.Stop()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Shutdown error")
	}

	nc.Close()
	redisClient.Close()
	db.Close()

	log.Info().Msg("Dispatch Service stopped")
}
