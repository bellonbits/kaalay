package repository

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/google/uuid"
)

type DriverRepository interface {
	GetDriverByID(ctx context.Context, id uuid.UUID) (interface{}, error)
	UpdateDriverStatus(ctx context.Context, id uuid.UUID, status string) error
	GetNearbyDrivers(ctx context.Context, lat, lng float64, radiusKm float64) ([]interface{}, error)
}

type PostgresDriverRepository struct {
	db *pgxpool.Pool
}

func NewPostgresDriverRepository(db *pgxpool.Pool) DriverRepository {
	return &PostgresDriverRepository{db: db}
}

func (r *PostgresDriverRepository) GetDriverByID(ctx context.Context, id uuid.UUID) (interface{}, error) {
	return nil, nil
}

func (r *PostgresDriverRepository) UpdateDriverStatus(ctx context.Context, id uuid.UUID, status string) error {
	return nil
}

func (r *PostgresDriverRepository) GetNearbyDrivers(ctx context.Context, lat, lng float64, radiusKm float64) ([]interface{}, error) {
	return []interface{}{}, nil
}
