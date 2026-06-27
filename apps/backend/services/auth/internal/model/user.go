package model

import (
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system.
type User struct {
	ID                  uuid.UUID `db:"id"`
	Phone               string    `db:"phone"`
	Email               *string   `db:"email"`
	FullName            *string   `db:"full_name"`
	Role                string    `db:"role"` // customer, merchant, driver, admin
	IsActive            bool      `db:"is_active"`
	AvatarURL           *string   `db:"avatar_url"`
	PreferredLanguage   string    `db:"preferred_language"`
	SuqafuranUserID     *uuid.UUID `db:"suqafuran_user_id"`
	CreatedAt           time.Time `db:"created_at"`
	UpdatedAt           time.Time `db:"updated_at"`
}

// OTPCode represents an OTP verification code.
type OTPCode struct {
	ID        uuid.UUID `db:"id"`
	Phone     string    `db:"phone"`
	CodeHash  string    `db:"code_hash"`
	ExpiresAt time.Time `db:"expires_at"`
	Attempts  int       `db:"attempts"`
	Used      bool      `db:"used"`
}

// RefreshToken represents a refresh token.
type RefreshToken struct {
	ID             uuid.UUID `db:"id"`
	UserID         uuid.UUID `db:"user_id"`
	TokenHash      string    `db:"token_hash"`
	DeviceFingerprint *string `db:"device_fingerprint"`
	ExpiresAt      time.Time `db:"expires_at"`
	Revoked        bool      `db:"revoked"`
}
