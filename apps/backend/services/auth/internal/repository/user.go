package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// User represents a user in the system.
type User struct {
	ID                uuid.UUID
	Phone             string
	Email             *string
	FullName          *string
	Role              string
	IsActive          bool
	AvatarURL         *string
	PreferredLanguage string
	SuqafuranUserID   *uuid.UUID
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// UserRepository defines user database operations.
type UserRepository interface {
	CreateUser(ctx context.Context, user *User) error
	GetUserByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetUserByPhone(ctx context.Context, phone string) (*User, error)
	UpdateUser(ctx context.Context, user *User) error
	DeleteUser(ctx context.Context, id uuid.UUID) error
}

// PostgresUserRepository implements UserRepository.
type PostgresUserRepository struct {
	db *pgxpool.Pool
}

// NewPostgresUserRepository creates a new postgres user repository.
func NewPostgresUserRepository(db *pgxpool.Pool) *PostgresUserRepository {
	return &PostgresUserRepository{db: db}
}

// CreateUser creates a new user.
func (r *PostgresUserRepository) CreateUser(ctx context.Context, user *User) error {
	query := `
		INSERT INTO users (id, phone, email, full_name, role, is_active, avatar_url, preferred_language, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRow(ctx, query,
		user.ID,
		user.Phone,
		user.Email,
		user.FullName,
		user.Role,
		user.IsActive,
		user.AvatarURL,
		user.PreferredLanguage,
		time.Now(),
		time.Now(),
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// GetUserByID retrieves a user by ID.
func (r *PostgresUserRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	query := `
		SELECT id, phone, email, full_name, role, is_active, avatar_url, preferred_language, suqafuran_user_id, created_at, updated_at
		FROM users
		WHERE id = $1 AND is_active = true
	`

	user := &User{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Phone,
		&user.Email,
		&user.FullName,
		&user.Role,
		&user.IsActive,
		&user.AvatarURL,
		&user.PreferredLanguage,
		&user.SuqafuranUserID,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}

// GetUserByPhone retrieves a user by phone number.
func (r *PostgresUserRepository) GetUserByPhone(ctx context.Context, phone string) (*User, error) {
	query := `
		SELECT id, phone, email, full_name, role, is_active, avatar_url, preferred_language, suqafuran_user_id, created_at, updated_at
		FROM users
		WHERE phone = $1 AND is_active = true
	`

	user := &User{}
	err := r.db.QueryRow(ctx, query, phone).Scan(
		&user.ID,
		&user.Phone,
		&user.Email,
		&user.FullName,
		&user.Role,
		&user.IsActive,
		&user.AvatarURL,
		&user.PreferredLanguage,
		&user.SuqafuranUserID,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return user, nil
}

// UpdateUser updates an existing user.
func (r *PostgresUserRepository) UpdateUser(ctx context.Context, user *User) error {
	query := `
		UPDATE users
		SET email = $1, full_name = $2, role = $3, is_active = $4, avatar_url = $5, preferred_language = $6, updated_at = $7
		WHERE id = $8
	`

	_, err := r.db.Exec(ctx, query,
		user.Email,
		user.FullName,
		user.Role,
		user.IsActive,
		user.AvatarURL,
		user.PreferredLanguage,
		time.Now(),
		user.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// DeleteUser marks a user as inactive (soft delete).
func (r *PostgresUserRepository) DeleteUser(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE users SET is_active = false, updated_at = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	return nil
}
