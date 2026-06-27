package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/suqafuran/express/shared/pkg"
)

// RequireRole middleware checks if user has one of the allowed roles.
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("user not authenticated"))
			c.Abort()
			return
		}

		userRole := role.(string)
		for _, allowed := range allowedRoles {
			if userRole == allowed {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, pkg.ErrorResponse("insufficient permissions"))
		c.Abort()
	}
}

// IsAdmin middleware checks if user is admin.
func IsAdmin() gin.HandlerFunc {
	return RequireRole("admin")
}

// IsDriver middleware checks if user is driver.
func IsDriver() gin.HandlerFunc {
	return RequireRole("driver")
}

// IsMerchant middleware checks if user is merchant.
func IsMerchant() gin.HandlerFunc {
	return RequireRole("merchant")
}

// IsCustomer middleware checks if user is customer.
func IsCustomer() gin.HandlerFunc {
	return RequireRole("customer")
}
