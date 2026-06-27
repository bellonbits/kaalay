package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/suqafuran/express/shared/pkg"
)

// JWTAuth middleware validates JWT tokens.
func JWTAuth(jwtMgr *pkg.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("missing authorization header"))
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("invalid authorization header format"))
			c.Abort()
			return
		}

		token := parts[1]
		claims, err := jwtMgr.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("invalid token: "+err.Error()))
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("phone", claims.Phone)
		c.Set("role", claims.Role)
		c.Set("device_id", claims.DeviceID)
		c.Set("claims", claims)
		c.Next()
	}
}

// OptionalJWTAuth middleware validates JWT tokens but doesn't fail if missing.
func OptionalJWTAuth(jwtMgr *pkg.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		token := parts[1]
		claims, err := jwtMgr.ValidateToken(token)
		if err == nil {
			c.Set("user_id", claims.UserID)
			c.Set("phone", claims.Phone)
			c.Set("role", claims.Role)
			c.Set("device_id", claims.DeviceID)
			c.Set("claims", claims)
		}
		c.Next()
	}
}
