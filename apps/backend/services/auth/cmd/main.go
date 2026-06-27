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
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/auth/config"
	"github.com/suqafuran/express/services/auth/internal/handler"
	"github.com/suqafuran/express/services/auth/internal/repository"
	"github.com/suqafuran/express/shared/middleware"
	"github.com/suqafuran/express/shared/pkg"
	_ "github.com/suqafuran/express/services/auth/cmd/docs"
)

func init() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
}

func main() {
	cfg := config.Load()

	log.Info().
		Int("port", cfg.Port).
		Str("database", cfg.DBConnStr).
		Msg("Starting Auth Service")

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
		Addr:     cfg.RedisURL,
		PoolSize: 10,
	})
	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Fatal().Err(err).Msg("Redis ping failed")
	}
	log.Info().Msg("Redis connected")

	// Initialize repositories and services
	userRepo := repository.NewPostgresUserRepository(db)
	jwtMgr := pkg.NewJWTManager(cfg.JWTSecret)
	authHandler := handler.NewHandler(db, redisClient, userRepo, jwtMgr)

	// Gin router
	r := gin.Default()

	// Health checks
	r.GET("/health", authHandler.HealthHandler)
	r.GET("/ready", authHandler.ReadyHandler)

	// Swagger UI
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Auth routes
	auth := r.Group("/v1/auth")
	{
		auth.POST("/send-otp", authHandler.SendOTPHandler)
		auth.POST("/verify-otp", authHandler.VerifyOTPHandler)
		auth.GET("/me", middleware.JWTAuth(jwtMgr), authHandler.MeHandler)
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
		log.Info().Msgf("Auth Service listening on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server error")
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutting down Auth Service")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Shutdown error")
	}

	db.Close()
	redisClient.Close()

	log.Info().Msg("Auth Service stopped")
}
