package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/notification/config"
	"github.com/suqafuran/express/services/notification/internal/model"
	"github.com/suqafuran/express/services/notification/internal/repository"
	"github.com/suqafuran/express/shared/pkg"
)

type NotificationHandler struct {
	repo   repository.NotificationRepository
	config *config.Config
	redis  *redis.Client
}

func NewNotificationHandler(repo repository.NotificationRepository, cfg *config.Config, redis *redis.Client) *NotificationHandler {
	return &NotificationHandler{
		repo:   repo,
		config: cfg,
		redis:  redis,
	}
}

func (h *NotificationHandler) ListNotifications(c *gin.Context) {
	userID := c.GetString("user_id")
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	if limit > 100 {
		limit = 100
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	notifications, err := h.repo.GetUserNotifications(ctx, userID, limit, offset)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list notifications")
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to list notifications"))
		return
	}

	if notifications == nil {
		notifications = make([]*model.Notification, 0)
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
		"notifications": notifications,
	}))
}

func (h *NotificationHandler) SendNotification(c *gin.Context) {
	var req model.SendNotificationRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Invalid request"))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	notif := &model.Notification{
		RecipientID: req.RecipientID,
		EventType:   req.EventType,
		TitleEn:     req.TitleEn,
		TitleSo:     req.TitleSo,
		BodyEn:      req.BodyEn,
		BodySo:      req.BodySo,
		Template:    req.Template,
		OrderID:     req.OrderID,
		DriverID:    req.DriverID,
		PaymentID:   req.PaymentID,
		Data:        req.Data,
		Status:      "pending",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := h.repo.CreateNotification(ctx, notif); err != nil {
		log.Error().Err(err).Msg("Failed to create notification")
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to send notification"))
		return
	}

	// TODO: Send via FCM, SMS, email based on preferences
	c.JSON(http.StatusCreated, pkg.SuccessResponse(map[string]interface{}{
		"id": notif.ID,
	}))
}

func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	notificationID := c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := h.repo.MarkAsRead(ctx, notificationID); err != nil {
		log.Error().Err(err).Msg("Failed to mark as read")
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to mark as read"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
		"read_at": time.Now().Unix(),
	}))
}

func (h *NotificationHandler) GetPreferences(c *gin.Context) {
	userID := c.GetString("user_id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	pref, err := h.repo.GetOrCreatePreference(ctx, userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get preferences")
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to get preferences"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(pref))
}

func (h *NotificationHandler) UpdatePreferences(c *gin.Context) {
	userID := c.GetString("user_id")

	var req model.NotificationPreference
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Invalid request"))
		return
	}

	req.UserID = userID
	req.UpdatedAt = time.Now()

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := h.repo.UpdatePreference(ctx, &req); err != nil {
		log.Error().Err(err).Msg("Failed to update preferences")
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to update preferences"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(req))
}

func (h *NotificationHandler) HandleOrderEvent(data []byte) {
	var event map[string]interface{}
	if err := json.Unmarshal(data, &event); err != nil {
		log.Warn().Err(err).Msg("Failed to unmarshal order event")
		return
	}

	// TODO: Create notification based on event type and send via preferred channels
	log.Debug().Str("event_type", "order").Msg("Received order event")
}

func (h *NotificationHandler) HandleDeliveryEvent(data []byte) {
	var event map[string]interface{}
	if err := json.Unmarshal(data, &event); err != nil {
		log.Warn().Err(err).Msg("Failed to unmarshal delivery event")
		return
	}

	// TODO: Create notification based on event type and send via preferred channels
	log.Debug().Str("event_type", "delivery").Msg("Received delivery event")
}

func (h *NotificationHandler) HandlePaymentEvent(data []byte) {
	var event map[string]interface{}
	if err := json.Unmarshal(data, &event); err != nil {
		log.Warn().Err(err).Msg("Failed to unmarshal payment event")
		return
	}

	// TODO: Create notification based on event type and send via preferred channels
	log.Debug().Str("event_type", "payment").Msg("Received payment event")
}
