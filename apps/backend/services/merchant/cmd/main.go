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
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/merchant/config"
	"github.com/suqafuran/express/services/merchant/internal/handler"
	"github.com/suqafuran/express/services/merchant/internal/repository"
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
		Msg("Starting Merchant Service")

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

	// Initialize repositories
	merchantRepo := repository.NewPostgresMerchantRepository(db)

	// Initialize handler
	merchantHandler := handler.NewHandler(db, merchantRepo)

	// JWT manager
	jwtMgr := pkg.NewJWTManager(cfg.JWTSecret)

	// Gin router
	r := gin.Default()

	// Health checks
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, pkg.HealthResponse{
			Status:  "healthy",
			Message: "Merchant service is running",
		})
	})

	r.GET("/ready", merchantHandler.ReadyHandler)

	// Merchant routes (public)
	merchants := r.Group("/v1/merchants")
	{
		merchants.GET("/:id", merchantHandler.GetMerchantHandler)
		merchants.GET("/slug/:slug", merchantHandler.GetMerchantBySlugHandler)
		merchants.GET("/nearby", merchantHandler.ListNearbyMerchantsHandler)
	}

	// Merchant routes (authenticated)
	merchantsAuth := r.Group("/v1/merchants")
	merchantsAuth.Use(middleware.JWTAuth(jwtMgr))
	{
		merchantsAuth.POST("", merchantHandler.CreateMerchantHandler)
		merchantsAuth.GET("/my/list", merchantHandler.ListMyMerchantsHandler)
		merchantsAuth.PATCH("/:id", merchantHandler.UpdateMerchantHandler)
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
		log.Info().Msgf("Merchant Service listening on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server error")
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutting down Merchant Service")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Shutdown error")
	}

	db.Close()

	log.Info().Msg("Merchant Service stopped")
}
