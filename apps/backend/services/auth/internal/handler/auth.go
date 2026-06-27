package handler

import (
	"crypto/sha256"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/suqafuran/express/shared/pkg"
)

// SendOTPRequest is the request body for sending OTP.
type SendOTPRequest struct {
	Phone string `json:"phone" binding:"required"`
}

// VerifyOTPRequest is the request body for verifying OTP.
type VerifyOTPRequest struct {
	Phone      string `json:"phone" binding:"required"`
	Code       string `json:"code" binding:"required"`
	DeviceID   string `json:"device_id"`
}

// AuthResponse is the response body after login/signup.
type AuthResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	User         UserDTO `json:"user"`
	IsNewUser    bool   `json:"isNewUser"`
}

// UserDTO is the user data transfer object.
type UserDTO struct {
	ID                uuid.UUID `json:"id"`
	Phone             string    `json:"phone"`
	Email             *string   `json:"email,omitempty"`
	FullName          *string   `json:"full_name,omitempty"`
	Role              string    `json:"role"`
	IsActive          bool      `json:"is_active"`
	PreferredLanguage string    `json:"preferred_language"`
}

// SendOTPHandler sends an OTP to a phone number.
func (h *Handler) SendOTPHandler(c *gin.Context) {
	var req SendOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid request"))
		return
	}

	// Generate 6-digit OTP
	code := fmt.Sprintf("%06d", rand.Intn(1000000))
	codeHash := fmt.Sprintf("%x", sha256.Sum256([]byte(code)))

	// Store in Redis with 5-minute TTL
	err := h.redis.Set(c.Request.Context(), fmt.Sprintf("otp:%s", req.Phone), codeHash, 5*time.Minute).Err()
	if err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to generate OTP"))
		return
	}

	// In production, send OTP via SMS (Africa's Talking, Twilio, etc.)
	// For dev, just log it
	fmt.Printf("[DEV] OTP for %s: %s\n", req.Phone, code)

	c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]string{
		"message": "OTP sent successfully",
	}))
}

// VerifyOTPHandler verifies an OTP and returns JWT tokens.
func (h *Handler) VerifyOTPHandler(c *gin.Context) {
	var req VerifyOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid request"))
		return
	}

	// Verify OTP from Redis
	expectedHash := fmt.Sprintf("%x", sha256.Sum256([]byte(req.Code)))
	storedHash, err := h.redis.Get(c.Request.Context(), fmt.Sprintf("otp:%s", req.Phone)).Result()
	if err != nil || storedHash != expectedHash {
		c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("invalid OTP"))
		return
	}

	// Remove OTP from Redis after successful verification
	h.redis.Del(c.Request.Context(), fmt.Sprintf("otp:%s", req.Phone))

	// Check if user exists
	user, err := h.repo.GetUserByPhone(c.Request.Context(), req.Phone)
	isNewUser := false

	if err != nil {
		// New user — create account
		isNewUser = true
		user = &User{
			ID:                uuid.New(),
			Phone:             req.Phone,
			Role:              "customer", // default role
			IsActive:          true,
			PreferredLanguage: "en",
			CreatedAt:         time.Now(),
			UpdatedAt:         time.Now(),
		}
		if err := h.repo.CreateUser(c.Request.Context(), user); err != nil {
			c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to create user"))
			return
		}
	}

	// Generate JWT tokens
	accessToken, err := h.jwtMgr.GenerateAccessToken(user.ID, user.Phone, user.Role, req.DeviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to generate token"))
		return
	}

	refreshToken, err := h.jwtMgr.GenerateRefreshToken(user.ID, user.Phone, user.Role, req.DeviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to generate refresh token"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: UserDTO{
			ID:                user.ID,
			Phone:             user.Phone,
			Email:             user.Email,
			FullName:          user.FullName,
			Role:              user.Role,
			IsActive:          user.IsActive,
			PreferredLanguage: user.PreferredLanguage,
		},
		IsNewUser: isNewUser,
	}))
}

// MeHandler returns current user profile.
func (h *Handler) MeHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("not authenticated"))
		return
	}

	user, err := h.repo.GetUserByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("user not found"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(UserDTO{
		ID:                user.ID,
		Phone:             user.Phone,
		Email:             user.Email,
		FullName:          user.FullName,
		Role:              user.Role,
		IsActive:          user.IsActive,
		PreferredLanguage: user.PreferredLanguage,
	}))
}

// HealthHandler returns service health.
func (h *Handler) HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, pkg.HealthResponse{
		Status:  "healthy",
		Message: "Auth service is running",
	})
}

// ReadyHandler checks if service is ready.
func (h *Handler) ReadyHandler(c *gin.Context) {
	// Check DB and Redis connectivity
	err := h.db.Ping(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, pkg.ReadyResponse{
			Ready: false,
			Details: map[string]string{
				"database": "unreachable",
			},
		})
		return
	}

	err = h.redis.Ping(c.Request.Context()).Err()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, pkg.ReadyResponse{
			Ready: false,
			Details: map[string]string{
				"redis": "unreachable",
			},
		})
		return
	}

	c.JSON(http.StatusOK, pkg.ReadyResponse{
		Ready: true,
		Details: map[string]string{
			"database": "ok",
			"redis":    "ok",
		},
	})
}
