package repository

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/google/uuid"
)

type UserRepository interface {
	GetUserByID(ctx context.Context, id uuid.UUID) (interface{}, error)
	UpdateUser(ctx context.Context, id uuid.UUID, data map[string]interface{}) error
	GetAddresses(ctx context.Context, userID uuid.UUID) ([]interface{}, error)
	AddAddress(ctx context.Context, userID uuid.UUID, address interface{}) error
}

type PostgresUserRepository struct {
	db *pgxpool.Pool
}

func NewPostgresUserRepository(db *pgxpool.Pool) UserRepository {
	return &PostgresUserRepository{db: db}
}

func (r *PostgresUserRepository) GetUserByID(ctx context.Context, id uuid.UUID) (interface{}, error) {
	return nil, nil
}

func (r *PostgresUserRepository) UpdateUser(ctx context.Context, id uuid.UUID, data map[string]interface{}) error {
	return nil
}

func (r *PostgresUserRepository) GetAddresses(ctx context.Context, userID uuid.UUID) ([]interface{}, error) {
	return []interface{}{}, nil
}

func (r *PostgresUserRepository) AddAddress(ctx context.Context, userID uuid.UUID, address interface{}) error {
	return nil
}
