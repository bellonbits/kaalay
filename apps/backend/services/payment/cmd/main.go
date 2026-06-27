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
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/payment/config"
	"github.com/suqafuran/express/services/payment/internal/handler"
	"github.com/suqafuran/express/services/payment/internal/repository"
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
		Msg("Starting Payment Service")

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

	// NATS connection
	nc, err := nats.Connect(cfg.NatsURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to NATS")
	}
	defer nc.Close()
	log.Info().Msg("NATS connected")

	// JWT manager
	jwtMgr := pkg.NewJWTManager(cfg.JWTSecret)

	// Repository
	repo := repository.NewPostgresPaymentRepository(db)

	// Payment handler
	paymentHandler := handler.NewPaymentHandler(repo, cfg, nc, redisClient)

	// Gin router
	r := gin.Default()

	// Health checks
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, pkg.HealthResponse{
			Status:  "healthy",
			Message: "Payment service is running",
		})
	})

	r.GET("/ready", func(c *gin.Context) {
		if err := db.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, pkg.ReadyResponse{
				Ready: false,
				Details: map[string]string{"database": "unreachable"},
			})
			return
		}
		if err := redisClient.Ping(c.Request.Context()).Err(); err != nil {
			c.JSON(http.StatusServiceUnavailable, pkg.ReadyResponse{
				Ready: false,
				Details: map[string]string{"redis": "unreachable"},
			})
			return
		}
		c.JSON(http.StatusOK, pkg.ReadyResponse{
			Ready: true,
			Details: map[string]string{"database": "ok", "redis": "ok", "nats": "ok"},
		})
	})

	// Payment routes
	payments := r.Group("/v1/payments")
	{
		// Public webhook for M-Pesa callbacks
		payments.POST("/mpesa/callback", paymentHandler.HandleMpesaCallback)

		// Authenticated endpoints
		payments.Use(middleware.JWTAuth(jwtMgr))
		{
			payments.POST("/initiate", paymentHandler.InitiatePayment)
			payments.GET("/:id", paymentHandler.GetPayment)
			payments.GET("/:id/status", paymentHandler.GetPaymentStatus)
			payments.POST("/:id/refund", paymentHandler.RefundPayment)
			payments.POST("/escrow/:id/release", paymentHandler.ReleaseEscrow)
		}
	}

	// Driver wallet routes
	wallets := r.Group("/v1/wallets")
	wallets.Use(middleware.JWTAuth(jwtMgr))
	{
		wallets.GET("/:driver_id", paymentHandler.GetDriverWallet)
		wallets.POST("/withdraw", paymentHandler.RequestWithdrawal)
		wallets.GET("/:driver_id/withdrawals", paymentHandler.GetWithdrawalHistory)
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
		log.Info().Msgf("Payment Service listening on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server error")
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutting down Payment Service")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Shutdown error")
	}

	redisClient.Close()
	db.Close()
	nc.Close()

	log.Info().Msg("Payment Service stopped")
}
