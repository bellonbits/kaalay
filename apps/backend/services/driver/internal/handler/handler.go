package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/suqafuran/express/services/driver/internal/repository"
	"github.com/suqafuran/express/shared/pkg"
)

type Handler struct {
	db       *pgxpool.Pool
	redis    *redis.Client
	repo     repository.DriverRepository
	jwtMgr   *pkg.JWTManager
}

func NewHandler(db *pgxpool.Pool, redis *redis.Client, repo repository.DriverRepository, jwtMgr *pkg.JWTManager) *Handler {
	return &Handler{
		db:     db,
		redis:  redis,
		repo:   repo,
		jwtMgr: jwtMgr,
	}
}

func (h *Handler) HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy"})
}

func (h *Handler) ReadyHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}

func (h *Handler) GetProfileHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "get profile"})
}

func (h *Handler) UpdateProfileHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "update profile"})
}

func (h *Handler) GetOffersHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"offers": []interface{}{}})
}

func (h *Handler) AcceptOfferHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "offer accepted"})
}

func (h *Handler) RejectOfferHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "offer rejected"})
}

func (h *Handler) GetActiveDeliveriesHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"deliveries": []interface{}{}})
}

func (h *Handler) GetDeliveryHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"delivery": map[string]interface{}{}})
}

func (h *Handler) UpdateDeliveryStatusHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "status updated"})
}

func (h *Handler) SubmitProofHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "proof submitted"})
}

func (h *Handler) GetEarningsHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"earnings": []interface{}{}})
}

func (h *Handler) GetTodayEarningsHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"today": 0.0, "currency": "KES"})
}

func (h *Handler) UpdateLocationHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "location updated"})
}

func (h *Handler) GetWalletHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"balance": 0.0, "currency": "KES"})
}

func (h *Handler) WithdrawHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"withdrawal_id": ""})
}

func (h *Handler) GetWithdrawalsHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"withdrawals": []interface{}{}})
}
