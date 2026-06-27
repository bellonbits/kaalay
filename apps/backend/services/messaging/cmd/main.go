package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/messaging/config"
	"github.com/suqafuran/express/services/messaging/internal/handler"
	"github.com/suqafuran/express/services/messaging/internal/model"
	"github.com/suqafuran/express/services/messaging/internal/repository"
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
		Str("redis", cfg.RedisURL).
		Msg("Starting Messaging Service")

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

	// JWT manager
	jwtMgr := pkg.NewJWTManager(cfg.JWTSecret)

	// Repository
	repo := repository.NewPostgresMessagingRepository(db)

	// WebSocket handler
	wsHandler := handler.NewWSHandler(repo)

	// Gin router
	r := gin.Default()

	// Health checks
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, pkg.HealthResponse{
			Status:  "healthy",
			Message: "Messaging service is running",
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

	// Messaging routes (authenticated)
	messages := r.Group("/v1/messages")
	messages.Use(middleware.JWTAuth(jwtMgr))
	{
		// Conversations
		messages.GET("/conversations", func(c *gin.Context) {
			userID := c.GetString("user_id")

			ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
			defer cancel()

			conversations, err := repo.GetUserConversations(ctx, userID)
			if err != nil {
				log.Error().Err(err).Msg("Failed to get conversations")
				c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to get conversations"))
				return
			}

			if conversations == nil {
				conversations = make([]*model.Conversation, 0)
			}

			c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
				"conversations": conversations,
			}))
		})

		messages.POST("/conversations", func(c *gin.Context) {
			var req struct {
				Type           string   `json:"type" binding:"required"`
				ParticipantIDs []string `json:"participant_ids" binding:"required"`
				OrderID        *string  `json:"order_id"`
			}

			if err := c.BindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Invalid request"))
				return
			}

			ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
			defer cancel()

			participantUUIDs := make([]uuid.UUID, len(req.ParticipantIDs))
			for i, id := range req.ParticipantIDs {
				if uid, err := uuid.Parse(id); err == nil {
					participantUUIDs[i] = uid
				}
			}

			var orderID *uuid.UUID
			if req.OrderID != nil {
				if uid, err := uuid.Parse(*req.OrderID); err == nil {
					orderID = &uid
				}
			}

			conv := &model.Conversation{
				Type:           req.Type,
				ParticipantIDs: participantUUIDs,
				OrderID:        orderID,
				IsActive:       true,
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			}

			if err := repo.Create(ctx, conv); err != nil {
				log.Error().Err(err).Msg("Failed to create conversation")
				c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to create conversation"))
				return
			}

			for _, participantID := range participantUUIDs {
				participant := &model.ConversationParticipant{
					ConversationID: conv.ID,
					UserID:         participantID,
					UserName:       participantID.String(),
					JoinedAt:       time.Now(),
				}
				_ = repo.CreateParticipant(ctx, participant)
			}

			c.JSON(http.StatusCreated, pkg.SuccessResponse(map[string]interface{}{
				"id": conv.ID,
			}))
		})

		// Messages
		messages.GET("/conversations/:id/messages", func(c *gin.Context) {
			conversationID := c.Param("id")

			limitStr := c.DefaultQuery("limit", "50")
			offsetStr := c.DefaultQuery("offset", "0")

			limit, _ := strconv.Atoi(limitStr)
			offset, _ := strconv.Atoi(offsetStr)

			if limit > 100 {
				limit = 100
			}

			ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
			defer cancel()

			msgs, err := repo.GetByConversationID(ctx, conversationID, limit, offset)
			if err != nil {
				log.Error().Err(err).Msg("Failed to get messages")
				c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to get messages"))
				return
			}

			if msgs == nil {
				msgs = make([]*model.Message, 0)
			}

			c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
				"messages": msgs,
			}))
		})

		messages.POST("/conversations/:id/messages", func(c *gin.Context) {
			conversationID := c.Param("id")
			userID := c.GetString("user_id")
			userName := c.GetString("user_name")

			var req struct {
				Content  string `json:"content" binding:"required"`
				Type     string `json:"type"`
				ImageURL string `json:"image_url"`
			}

			if err := c.BindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Invalid request"))
				return
			}

			ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
			defer cancel()

			msgType := req.Type
			if msgType == "" {
				msgType = "text"
			}

			imageURL := (*string)(nil)
			if req.ImageURL != "" {
				imageURL = &req.ImageURL
			}

			convID, _ := uuid.Parse(conversationID)
			userIDUUID, _ := uuid.Parse(userID)

			msg := &model.Message{
				ConversationID: convID,
				SenderID:       userIDUUID,
				SenderName:     userName,
				Content:        req.Content,
				MessageType:    msgType,
				ImageURL:       imageURL,
				CreatedAt:      time.Now(),
			}

			if err := repo.CreateMessage(ctx, msg); err != nil {
				log.Error().Err(err).Msg("Failed to create message")
				c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to create message"))
				return
			}

			c.JSON(http.StatusCreated, pkg.SuccessResponse(map[string]interface{}{
				"id": msg.ID,
			}))
		})

		// Read receipts
		messages.POST("/messages/:id/read", func(c *gin.Context) {
			messageID := c.Param("id")
			userID := c.GetString("user_id")

			ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
			defer cancel()

			msg, err := repo.GetMessageByID(ctx, messageID)
			if err != nil {
				c.JSON(http.StatusNotFound, pkg.ErrorResponse("Message not found"))
				return
			}

			msgIDUUID, _ := uuid.Parse(messageID)
			userIDUUID, _ := uuid.Parse(userID)

			receipt := &model.ReadReceipt{
				MessageID: msgIDUUID,
				ReaderID:  userIDUUID,
				ReadAt:    time.Now(),
			}

			if err := repo.CreateReadReceipt(ctx, receipt); err != nil {
				log.Error().Err(err).Msg("Failed to create read receipt")
				c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to mark as read"))
				return
			}

			_ = repo.UpdateLastReadMessage(ctx, msg.ConversationID.String(), userIDUUID.String(), msgIDUUID.String())

			c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
				"read_at": receipt.ReadAt.Unix(),
			}))
		})

		// WebSocket for async chat
		messages.GET("/ws/:conversation_id", func(c *gin.Context) {
			userID := c.GetString("user_id")
			userName := c.GetString("user_name")

			c.Set("user_id", userID)
			c.Set("user_name", userName)

			wsHandler.HandleConnection(c)
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
		log.Info().Msgf("Messaging Service listening on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server error")
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutting down Messaging Service")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Shutdown error")
	}

	redisClient.Close()
	db.Close()

	log.Info().Msg("Messaging Service stopped")
}
