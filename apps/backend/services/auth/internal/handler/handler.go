package handler

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/suqafuran/express/shared/pkg"
	"github.com/suqafuran/express/services/auth/internal/repository"
)

// Handler contains all auth endpoint handlers.
type Handler struct {
	db     *pgxpool.Pool
	redis  *redis.Client
	repo   repository.UserRepository
	jwtMgr *pkg.JWTManager
}

// NewHandler creates a new handler.
func NewHandler(db *pgxpool.Pool, redis *redis.Client, repo repository.UserRepository, jwtMgr *pkg.JWTManager) *Handler {
	return &Handler{
		db:     db,
		redis:  redis,
		repo:   repo,
		jwtMgr: jwtMgr,
	}
}

// User is an internal type alias for model.User
type User = repository.User
