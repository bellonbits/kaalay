package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/suqafuran/express/services/user/internal/repository"
	"github.com/suqafuran/express/shared/pkg"
)

type Handler struct {
	db     *pgxpool.Pool
	redis  *redis.Client
	repo   repository.UserRepository
	jwtMgr *pkg.JWTManager
}

func NewHandler(db *pgxpool.Pool, redis *redis.Client, repo repository.UserRepository, jwtMgr *pkg.JWTManager) *Handler {
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

func (h *Handler) GetAddressesHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"addresses": []interface{}{}})
}

func (h *Handler) AddAddressHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"address_id": ""})
}
