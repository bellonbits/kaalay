package model

import (
	"time"

	"github.com/google/uuid"
)

// Merchant represents a store on Suqafuran Express.
type Merchant struct {
	ID                   uuid.UUID
	UserID               uuid.UUID
	StoreName            string
	Slug                 string // unique, URL-friendly
	DescriptionEn        *string
	DescriptionSo        *string
	LogoURL              *string
	BannerURL            *string
	LocationLat          *float64
	LocationLng          *float64
	Address              *string
	Phone                *string
	Email                *string
	IsVerified           bool
	IsActive             bool
	Rating               float64
	TotalOrders          int
	SuqafuranBusinessID  *uuid.UUID // Link to Suqafuran marketplace
	CreatedAt            time.Time
	UpdatedAt            time.Time
}

// Product represents a product sold by a merchant.
type Product struct {
	ID                  uuid.UUID
	MerchantID          uuid.UUID
	NameEn              string
	NameSo              *string
	DescriptionEn       *string
	DescriptionSo       *string
	SKU                 *string
	Price               float64
	DiscountPrice       *float64
	StockLevel          int
	LowStockThreshold   int
	Category            *string
	Images              []string // JSON array of image URLs
	Variants            map[string][]string // {size: [...], color: [...]}
	IsActive            bool
	SuqafuranProductID  *uuid.UUID
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

// StoreHours represents when a store is open.
type StoreHours struct {
	ID         uuid.UUID
	MerchantID uuid.UUID
	DayOfWeek  int // 0 (Sunday) to 6 (Saturday)
	OpenTime   time.Time
	CloseTime  time.Time
	IsClosed   bool
	CreatedAt  time.Time
}

// MerchantEmployee represents staff at a merchant.
type MerchantEmployee struct {
	ID         uuid.UUID
	MerchantID uuid.UUID
	UserID     uuid.UUID
	Role       string // owner, admin, manager, sales_agent, support_agent, inventory_staff, delivery_staff
	IsActive   bool
	CreatedAt  time.Time
}

// MerchantCustomer represents a customer in the merchant's CRM.
type MerchantCustomer struct {
	ID            uuid.UUID
	MerchantID    uuid.UUID
	CustomerID    uuid.UUID
	TotalOrders   int
	TotalSpent    float64
	LoyaltyScore  int
	Segmentation  string // new, regular, vip, inactive
	LastOrderAt   *time.Time
	CreatedAt     time.Time
}

// NewMerchant creates a new merchant.
func NewMerchant(userID uuid.UUID, storeName, slug string) *Merchant {
	return &Merchant{
		ID:        uuid.New(),
		UserID:    userID,
		StoreName: storeName,
		Slug:      slug,
		IsActive:  true,
		Rating:    5.0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// NewProduct creates a new product.
func NewProduct(merchantID uuid.UUID, nameEn string, price float64) *Product {
	return &Product{
		ID:              uuid.New(),
		MerchantID:      merchantID,
		NameEn:          nameEn,
		Price:           price,
		StockLevel:      0,
		LowStockThreshold: 5,
		IsActive:        true,
		Variants:        make(map[string][]string),
		Images:          []string{},
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
}

// IsCurrentlyOpen checks if store is open at given time.
func (m *Merchant) IsCurrentlyOpen(hours []*StoreHours, currentTime time.Time) bool {
	dayOfWeek := int(currentTime.Weekday())

	for _, h := range hours {
		if h.DayOfWeek == dayOfWeek {
			if h.IsClosed {
				return false
			}

			// Compare times
			openHour := h.OpenTime.Hour()
			openMin := h.OpenTime.Minute()
			closeHour := h.CloseTime.Hour()
			closeMin := h.CloseTime.Minute()

			currentHour := currentTime.Hour()
			currentMin := currentTime.Minute()

			openMinutes := openHour*60 + openMin
			closeMinutes := closeHour*60 + closeMin
			currentMinutes := currentHour*60 + currentMin

			return currentMinutes >= openMinutes && currentMinutes < closeMinutes
		}
	}

	return false
}

// GetLowStockProducts returns products below threshold.
func GetLowStockProducts(products []*Product) []*Product {
	var lowStock []*Product
	for _, p := range products {
		if p.StockLevel <= p.LowStockThreshold {
			lowStock = append(lowStock, p)
		}
	}
	return lowStock
}
