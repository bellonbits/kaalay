package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/suqafuran/express/services/merchant/internal/model"
	"github.com/suqafuran/express/shared/pkg"
)

// CreateMerchantRequest is the request body for creating a merchant.
type CreateMerchantRequest struct {
	StoreName        string  `json:"store_name" binding:"required"`
	Slug             string  `json:"slug" binding:"required"`
	DescriptionEn    *string `json:"description_en"`
	DescriptionSo    *string `json:"description_so"`
	LogoURL          *string `json:"logo_url"`
	LocationLat      *float64 `json:"location_lat"`
	LocationLng      *float64 `json:"location_lng"`
	Address          *string `json:"address"`
	Phone            *string `json:"phone"`
	Email            *string `json:"email"`
}

// UpdateMerchantRequest is the request body for updating a merchant.
type UpdateMerchantRequest struct {
	StoreName     *string  `json:"store_name"`
	DescriptionEn *string  `json:"description_en"`
	DescriptionSo *string  `json:"description_so"`
	LogoURL       *string  `json:"logo_url"`
	LocationLat   *float64 `json:"location_lat"`
	LocationLng   *float64 `json:"location_lng"`
	Address       *string  `json:"address"`
	Phone         *string  `json:"phone"`
	Email         *string  `json:"email"`
}

// MerchantDTO is the data transfer object for merchants.
type MerchantDTO struct {
	ID                  uuid.UUID `json:"id"`
	StoreName           string    `json:"store_name"`
	Slug                string    `json:"slug"`
	DescriptionEn       *string   `json:"description_en,omitempty"`
	DescriptionSo       *string   `json:"description_so,omitempty"`
	LogoURL             *string   `json:"logo_url,omitempty"`
	LocationLat         *float64  `json:"location_lat,omitempty"`
	LocationLng         *float64  `json:"location_lng,omitempty"`
	Address             *string   `json:"address,omitempty"`
	Phone               *string   `json:"phone,omitempty"`
	Email               *string   `json:"email,omitempty"`
	IsVerified          bool      `json:"is_verified"`
	IsActive            bool      `json:"is_active"`
	Rating              float64   `json:"rating"`
	TotalOrders         int       `json:"total_orders"`
	CreatedAt           int64     `json:"created_at"`
	UpdatedAt           int64     `json:"updated_at"`
}

// ProductDTO is the data transfer object for products.
type ProductDTO struct {
	ID           uuid.UUID              `json:"id"`
	NameEn       string                 `json:"name_en"`
	NameSo       *string                `json:"name_so,omitempty"`
	Price        float64                `json:"price"`
	DiscountPrice *float64              `json:"discount_price,omitempty"`
	StockLevel   int                    `json:"stock_level"`
	Category     *string                `json:"category,omitempty"`
	Images       []string               `json:"images"`
	Variants     map[string][]string    `json:"variants"`
	IsActive     bool                   `json:"is_active"`
	CreatedAt    int64                  `json:"created_at"`
	UpdatedAt    int64                  `json:"updated_at"`
}

// CreateMerchantHandler creates a new merchant.
func (h *Handler) CreateMerchantHandler(c *gin.Context) {
	var req CreateMerchantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid request"))
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("not authenticated"))
		return
	}

	merchant := model.NewMerchant(userID.(uuid.UUID), req.StoreName, req.Slug)
	merchant.DescriptionEn = req.DescriptionEn
	merchant.DescriptionSo = req.DescriptionSo
	merchant.LogoURL = req.LogoURL
	merchant.LocationLat = req.LocationLat
	merchant.LocationLng = req.LocationLng
	merchant.Address = req.Address
	merchant.Phone = req.Phone
	merchant.Email = req.Email

	if err := h.repo.CreateMerchant(c.Request.Context(), merchant); err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to create merchant"))
		return
	}

	c.JSON(http.StatusCreated, pkg.SuccessResponse(h.merchantToDTO(merchant)))
}

// GetMerchantHandler retrieves a merchant.
func (h *Handler) GetMerchantHandler(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid merchant ID"))
		return
	}

	merchant, err := h.repo.GetMerchantByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("merchant not found"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(h.merchantToDTO(merchant)))
}

// GetMerchantBySlugHandler retrieves a merchant by slug.
func (h *Handler) GetMerchantBySlugHandler(c *gin.Context) {
	slug := c.Param("slug")

	merchant, err := h.repo.GetMerchantBySlug(c.Request.Context(), slug)
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("merchant not found"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(h.merchantToDTO(merchant)))
}

// ListNearbyMerchantsHandler retrieves nearby merchants.
func (h *Handler) ListNearbyMerchantsHandler(c *gin.Context) {
	lat, err := strconv.ParseFloat(c.Query("lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid latitude"))
		return
	}

	lng, err := strconv.ParseFloat(c.Query("lng"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid longitude"))
		return
	}

	radiusKm := 10
	if r := c.Query("radius_km"); r != "" {
		if parsed, err := strconv.Atoi(r); err == nil && parsed > 0 {
			radiusKm = parsed
		}
	}

	merchants, err := h.repo.ListNearbyMerchants(c.Request.Context(), lat, lng, radiusKm, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to list merchants"))
		return
	}

	items := make([]MerchantDTO, len(merchants))
	for i, m := range merchants {
		items[i] = h.merchantToDTO(m)
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
		"merchants": items,
		"count":     len(items),
	}))
}

// UpdateMerchantHandler updates a merchant (owner only).
func (h *Handler) UpdateMerchantHandler(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid merchant ID"))
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("not authenticated"))
		return
	}

	merchant, err := h.repo.GetMerchantByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("merchant not found"))
		return
	}

	// Verify ownership
	if merchant.UserID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, pkg.ErrorResponse("not authorized"))
		return
	}

	var req UpdateMerchantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid request"))
		return
	}

	if req.StoreName != nil {
		merchant.StoreName = *req.StoreName
	}
	if req.DescriptionEn != nil {
		merchant.DescriptionEn = req.DescriptionEn
	}
	if req.DescriptionSo != nil {
		merchant.DescriptionSo = req.DescriptionSo
	}
	if req.LogoURL != nil {
		merchant.LogoURL = req.LogoURL
	}
	if req.LocationLat != nil {
		merchant.LocationLat = req.LocationLat
	}
	if req.LocationLng != nil {
		merchant.LocationLng = req.LocationLng
	}
	if req.Address != nil {
		merchant.Address = req.Address
	}
	if req.Phone != nil {
		merchant.Phone = req.Phone
	}
	if req.Email != nil {
		merchant.Email = req.Email
	}

	if err := h.repo.UpdateMerchant(c.Request.Context(), merchant); err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to update merchant"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(h.merchantToDTO(merchant)))
}

// ListMyMerchantsHandler lists all merchants owned by current user.
func (h *Handler) ListMyMerchantsHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("not authenticated"))
		return
	}

	merchants, err := h.repo.ListMerchantsByUser(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to list merchants"))
		return
	}

	items := make([]MerchantDTO, len(merchants))
	for i, m := range merchants {
		items[i] = h.merchantToDTO(m)
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
		"merchants": items,
		"count":     len(items),
	}))
}

// HealthHandler returns service health.
func (h *Handler) HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, pkg.HealthResponse{
		Status:  "healthy",
		Message: "Merchant service is running",
	})
}

// ReadyHandler checks if service is ready.
func (h *Handler) ReadyHandler(c *gin.Context) {
	if err := h.db.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, pkg.ReadyResponse{
			Ready: false,
			Details: map[string]string{
				"database": "unreachable",
			},
		})
		return
	}

	c.JSON(http.StatusOK, pkg.ReadyResponse{
		Ready: true,
		Details: map[string]string{
			"database": "ok",
		},
	})
}

// Helper functions

func (h *Handler) merchantToDTO(merchant *model.Merchant) MerchantDTO {
	return MerchantDTO{
		ID:            merchant.ID,
		StoreName:     merchant.StoreName,
		Slug:          merchant.Slug,
		DescriptionEn: merchant.DescriptionEn,
		DescriptionSo: merchant.DescriptionSo,
		LogoURL:       merchant.LogoURL,
		LocationLat:   merchant.LocationLat,
		LocationLng:   merchant.LocationLng,
		Address:       merchant.Address,
		Phone:         merchant.Phone,
		Email:         merchant.Email,
		IsVerified:    merchant.IsVerified,
		IsActive:      merchant.IsActive,
		Rating:        merchant.Rating,
		TotalOrders:   merchant.TotalOrders,
		CreatedAt:     merchant.CreatedAt.Unix(),
		UpdatedAt:     merchant.UpdatedAt.Unix(),
	}
}

func (h *Handler) productToDTO(product *model.Product) ProductDTO {
	return ProductDTO{
		ID:            product.ID,
		NameEn:        product.NameEn,
		NameSo:        product.NameSo,
		Price:         product.Price,
		DiscountPrice: product.DiscountPrice,
		StockLevel:    product.StockLevel,
		Category:      product.Category,
		Images:        product.Images,
		Variants:      product.Variants,
		IsActive:      product.IsActive,
		CreatedAt:     product.CreatedAt.Unix(),
		UpdatedAt:     product.UpdatedAt.Unix(),
	}
}
