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
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/tracking/config"
	"github.com/suqafuran/express/services/tracking/internal/handler"
	"github.com/suqafuran/express/services/tracking/internal/repository"
	"github.com/suqafuran/express/shared/middleware"
	"github.com/suqafuran/express/shared/pkg"
	"nhooyr.io/websocket"
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
		Msg("Starting Tracking Service")

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

	// Initialize repositories
	trackingRepo := repository.NewPostgresTrackingRepository(db)

	// Initialize WebSocket hub
	wsHub := handler.NewWSHub(redisClient)

	// JWT manager
	jwtMgr := pkg.NewJWTManager(cfg.JWTSecret)

	// Gin router
	r := gin.Default()

	// Health checks
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, pkg.HealthResponse{
			Status:  "healthy",
			Message: "Tracking service is running",
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

		if err := redisClient.Ping(c.Request.Context()).Err(); err != nil {
			c.JSON(http.StatusServiceUnavailable, pkg.ReadyResponse{
				Ready: false,
				Details: map[string]string{
					"redis": "unreachable",
				},
			})
			return
		}

		c.JSON(http.StatusOK, pkg.ReadyResponse{
			Ready: true,
			Details: map[string]string{
				"database": "ok",
				"redis":    "ok",
			},
		})
	})

	// WebSocket endpoints (authenticated)
	tracking := r.Group("/v1/tracking")
	tracking.Use(middleware.JWTAuth(jwtMgr))
	{
		// WebSocket endpoints
		tracking.GET("/ws/order/:order_id", func(c *gin.Context) {
			handleTrackingWebSocket(c, wsHub, trackingRepo)
		})

		tracking.GET("/ws/driver", func(c *gin.Context) {
			handleDriverWebSocket(c, wsHub, trackingRepo)
		})

		// REST endpoints
		tracking.GET("/location-history/:driver_id", func(c *gin.Context) {
			driverID, err := uuid.Parse(c.Param("driver_id"))
			if err != nil {
				c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid driver ID"))
				return
			}

			locations, err := trackingRepo.GetLocationHistory(c.Request.Context(), driverID, 100)
			if err != nil {
				c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to get location history"))
				return
			}

			c.JSON(http.StatusOK, pkg.SuccessResponse(locations))
		})
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
		log.Info().Msgf("Tracking Service listening on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server error")
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutting down Tracking Service")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Shutdown error")
	}

	redisClient.Close()
	db.Close()

	log.Info().Msg("Tracking Service stopped")
}

// handleTrackingWebSocket handles customer/merchant tracking a delivery.
func handleTrackingWebSocket(c *gin.Context, hub *handler.WSHub, repo repository.TrackingRepository) {
	userID, _ := c.Get("user_id")
	orderID := c.Param("order_id")
	userType := c.DefaultQuery("type", "customer") // customer or merchant

	// Upgrade connection
	conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{})
	if err != nil {
		log.Error().Err(err).Msg("Failed to upgrade WebSocket")
		return
	}

	// Handle connection (this is async)
	hub.HandleConnection(conn, userID.(uuid.UUID), userType, orderID)
}

// handleDriverWebSocket handles driver sending location updates.
func handleDriverWebSocket(c *gin.Context, hub *handler.WSHub, repo repository.TrackingRepository) {
	userID, _ := c.Get("user_id")

	// For drivers, order_id is the current delivery order
	orderID := c.DefaultQuery("order_id", "")

	// Upgrade connection
	conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{})
	if err != nil {
		log.Error().Err(err).Msg("Failed to upgrade WebSocket")
		return
	}

	// Handle connection
	hub.HandleConnection(conn, userID.(uuid.UUID), "driver", orderID)
}
