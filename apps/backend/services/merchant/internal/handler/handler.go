package handler

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/suqafuran/express/services/merchant/internal/repository"
)

// Handler contains all merchant endpoint handlers.
type Handler struct {
	db   *pgxpool.Pool
	repo repository.MerchantRepository
}

// NewHandler creates a new handler.
func NewHandler(db *pgxpool.Pool, repo repository.MerchantRepository) *Handler {
	return &Handler{
		db:   db,
		repo: repo,
	}
}
