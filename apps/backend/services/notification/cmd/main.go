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
	"github.com/suqafuran/express/services/notification/config"
	"github.com/suqafuran/express/services/notification/internal/handler"
	"github.com/suqafuran/express/services/notification/internal/repository"
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
		Str("nats", cfg.NatsAddr).
		Msg("Starting Notification Service")

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
	nc, err := nats.Connect(cfg.NatsAddr)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to NATS")
	}
	defer nc.Close()
	log.Info().Msg("NATS connected")

	// JWT manager
	jwtMgr := pkg.NewJWTManager(cfg.JWTSecret)

	// Repository
	repo := repository.NewPostgresNotificationRepository(db)

	// Notification handler
	notifHandler := handler.NewNotificationHandler(repo, cfg, redisClient)

	// Subscribe to order events
	go subscribeToOrderEvents(nc, notifHandler)
	go subscribeToDeliveryEvents(nc, notifHandler)
	go subscribeToPaymentEvents(nc, notifHandler)

	// Gin router
	r := gin.Default()

	// Health checks
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, pkg.HealthResponse{
			Status:  "healthy",
			Message: "Notification service is running",
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

	// Notification routes
	notifications := r.Group("/v1/notifications")
	notifications.Use(middleware.JWTAuth(jwtMgr))
	{
		notifications.GET("", notifHandler.ListNotifications)
		notifications.POST("", notifHandler.SendNotification)
		notifications.PUT("/:id/read", notifHandler.MarkAsRead)
		notifications.PUT("/preferences", notifHandler.UpdatePreferences)
		notifications.GET("/preferences", notifHandler.GetPreferences)
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
		log.Info().Msgf("Notification Service listening on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server error")
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutting down Notification Service")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Shutdown error")
	}

	redisClient.Close()
	db.Close()
	nc.Close()

	log.Info().Msg("Notification Service stopped")
}

func subscribeToOrderEvents(nc *nats.Conn, handler *handler.NotificationHandler) {
	sub, err := nc.Subscribe("order.*", func(msg *nats.Msg) {
		handler.HandleOrderEvent(msg.Data)
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to subscribe to order events")
		return
	}
	log.Info().Msg("Subscribed to order.* events")
	_ = sub
}

func subscribeToDeliveryEvents(nc *nats.Conn, handler *handler.NotificationHandler) {
	sub, err := nc.Subscribe("delivery.*", func(msg *nats.Msg) {
		handler.HandleDeliveryEvent(msg.Data)
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to subscribe to delivery events")
		return
	}
	log.Info().Msg("Subscribed to delivery.* events")
	_ = sub
}

func subscribeToPaymentEvents(nc *nats.Conn, handler *handler.NotificationHandler) {
	sub, err := nc.Subscribe("payment.*", func(msg *nats.Msg) {
		handler.HandlePaymentEvent(msg.Data)
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to subscribe to payment events")
		return
	}
	log.Info().Msg("Subscribed to payment.* events")
	_ = sub
}
