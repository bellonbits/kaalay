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
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/user/config"
	"github.com/suqafuran/express/services/user/internal/handler"
	"github.com/suqafuran/express/services/user/internal/repository"
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
		Msg("Starting User Service")

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

	// Initialize repositories and services
	userRepo := repository.NewPostgresUserRepository(db)
	jwtMgr := pkg.NewJWTManager(cfg.JWTSecret)
	userHandler := handler.NewHandler(db, redisClient, userRepo, jwtMgr)

	// Gin router
	r := gin.Default()

	// Health checks
	r.GET("/health", userHandler.HealthHandler)
	r.GET("/ready", userHandler.ReadyHandler)

	// User routes
	v1 := r.Group("/v1")
	{
		users := v1.Group("/users")
		{
			users.GET("/profile", middleware.JWTAuth(jwtMgr), userHandler.GetProfileHandler)
			users.PUT("/profile", middleware.JWTAuth(jwtMgr), userHandler.UpdateProfileHandler)
			users.GET("/addresses", middleware.JWTAuth(jwtMgr), userHandler.GetAddressesHandler)
			users.POST("/addresses", middleware.JWTAuth(jwtMgr), userHandler.AddAddressHandler)
		}
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
		log.Info().Msgf("User Service listening on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server error")
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutting down User Service")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Shutdown error")
	}

	db.Close()
	redisClient.Close()

	log.Info().Msg("User Service stopped")
}
