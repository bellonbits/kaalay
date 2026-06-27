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
	"github.com/suqafuran/express/services/driver/config"
	"github.com/suqafuran/express/services/driver/internal/handler"
	"github.com/suqafuran/express/services/driver/internal/repository"
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
		Msg("Starting Driver Service")

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
	driverRepo := repository.NewPostgresDriverRepository(db)
	jwtMgr := pkg.NewJWTManager(cfg.JWTSecret)
	driverHandler := handler.NewHandler(db, redisClient, driverRepo, jwtMgr)

	// Gin router
	r := gin.Default()

	// Health checks
	r.GET("/health", driverHandler.HealthHandler)
	r.GET("/ready", driverHandler.ReadyHandler)

	// Driver routes
	v1 := r.Group("/v1")
	{
		drivers := v1.Group("/drivers")
		{
			drivers.GET("/profile", middleware.JWTAuth(jwtMgr), driverHandler.GetProfileHandler)
			drivers.PUT("/profile", middleware.JWTAuth(jwtMgr), driverHandler.UpdateProfileHandler)
			drivers.GET("/offers", middleware.JWTAuth(jwtMgr), driverHandler.GetOffersHandler)
			drivers.POST("/offers/:id/accept", middleware.JWTAuth(jwtMgr), driverHandler.AcceptOfferHandler)
			drivers.POST("/offers/:id/reject", middleware.JWTAuth(jwtMgr), driverHandler.RejectOfferHandler)
			drivers.GET("/deliveries/active", middleware.JWTAuth(jwtMgr), driverHandler.GetActiveDeliveriesHandler)
			drivers.GET("/deliveries/:id", middleware.JWTAuth(jwtMgr), driverHandler.GetDeliveryHandler)
			drivers.PATCH("/deliveries/:id/status", middleware.JWTAuth(jwtMgr), driverHandler.UpdateDeliveryStatusHandler)
			drivers.POST("/deliveries/:id/proof", middleware.JWTAuth(jwtMgr), driverHandler.SubmitProofHandler)
			drivers.GET("/earnings", middleware.JWTAuth(jwtMgr), driverHandler.GetEarningsHandler)
			drivers.GET("/earnings/today", middleware.JWTAuth(jwtMgr), driverHandler.GetTodayEarningsHandler)
			drivers.POST("/location", middleware.JWTAuth(jwtMgr), driverHandler.UpdateLocationHandler)
		}

		wallets := v1.Group("/wallets")
		{
			wallets.GET("/:id", middleware.JWTAuth(jwtMgr), driverHandler.GetWalletHandler)
			wallets.POST("/withdraw", middleware.JWTAuth(jwtMgr), driverHandler.WithdrawHandler)
			wallets.GET("/:id/withdrawals", middleware.JWTAuth(jwtMgr), driverHandler.GetWithdrawalsHandler)
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
		log.Info().Msgf("Driver Service listening on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server error")
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutting down Driver Service")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Shutdown error")
	}

	db.Close()
	redisClient.Close()

	log.Info().Msg("Driver Service stopped")
}
