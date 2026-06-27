package pkg

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// UserClaims is the JWT claims structure.
type UserClaims struct {
	UserID   uuid.UUID `json:"user_id"`
	Phone    string    `json:"phone"`
	Role     string    `json:"role"`
	DeviceID string    `json:"device_id,omitempty"`
	jwt.RegisteredClaims
}

// JWTManager handles JWT operations.
type JWTManager struct {
	secret     string
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// NewJWTManager creates a new JWT manager.
func NewJWTManager(secret string) *JWTManager {
	return &JWTManager{
		secret:     secret,
		accessTTL:  7 * 24 * time.Hour,  // 7 days
		refreshTTL: 30 * 24 * time.Hour, // 30 days
	}
}

// GenerateAccessToken creates an access token.
func (jm *JWTManager) GenerateAccessToken(userID uuid.UUID, phone, role, deviceID string) (string, error) {
	claims := UserClaims{
		UserID:   userID,
		Phone:    phone,
		Role:     role,
		DeviceID: deviceID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(jm.accessTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "suqafuran-express",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jm.secret))
}

// GenerateRefreshToken creates a refresh token.
func (jm *JWTManager) GenerateRefreshToken(userID uuid.UUID, phone, role, deviceID string) (string, error) {
	claims := UserClaims{
		UserID:   userID,
		Phone:    phone,
		Role:     role,
		DeviceID: deviceID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(jm.refreshTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "suqafuran-express",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jm.secret))
}

// ValidateToken verifies a JWT token.
func (jm *JWTManager) ValidateToken(tokenString string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(jm.secret), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*UserClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}
