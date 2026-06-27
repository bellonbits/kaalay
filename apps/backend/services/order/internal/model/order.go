package model

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// OrderType represents the type of delivery order.
type OrderType string

const (
	OrderTypeMarketplace OrderType = "marketplace"
	OrderTypeGrocery     OrderType = "grocery"
	OrderTypeRestaurant  OrderType = "restaurant"
	OrderTypeParcel      OrderType = "parcel"
	OrderTypeSameDay     OrderType = "same_day"
	OrderTypeScheduled   OrderType = "scheduled"
)

// OrderStatus represents the lifecycle state of an order.
type OrderStatus string

const (
	OrderStatusPending            OrderStatus = "pending"
	OrderStatusAccepted           OrderStatus = "accepted"
	OrderStatusPreparing          OrderStatus = "preparing"
	OrderStatusReadyForPickup     OrderStatus = "ready_for_pickup"
	OrderStatusDriverAssigned     OrderStatus = "driver_assigned"
	OrderStatusPickedUp           OrderStatus = "picked_up"
	OrderStatusInTransit          OrderStatus = "in_transit"
	OrderStatusDelivered          OrderStatus = "delivered"
	OrderStatusCancelled          OrderStatus = "cancelled"
)

// PaymentStatus represents payment state.
type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusCompleted PaymentStatus = "completed"
	PaymentStatusFailed    PaymentStatus = "failed"
	PaymentStatusRefunded  PaymentStatus = "refunded"
)

// Order represents a delivery order.
type Order struct {
	ID                uuid.UUID
	CustomerID        uuid.UUID
	MerchantID        *uuid.UUID
	Type              OrderType
	Status            OrderStatus
	TotalAmount       *float64
	DeliveryFee       *float64
	PlatformFee       *float64
	Currency          string
	PickupLat         *float64
	PickupLng         *float64
	PickupAddress     string
	DropoffLat        *float64
	DropoffLng        *float64
	DropoffAddress    string
	ScheduledAt       *time.Time
	SpecialInstructions string
	PaymentStatus     PaymentStatus
	PaymentMethod     string
	CustomerPhone     string
	CustomerName      string
	CreatedAt         time.Time
	UpdatedAt         time.Time
	Items             []OrderItem
}

// OrderItem represents an item in an order.
type OrderItem struct {
	ID           uuid.UUID
	OrderID      uuid.UUID
	ProductID    *uuid.UUID
	ProductName  string
	ProductNameSo string
	Quantity     int
	UnitPrice    float64
	Subtotal     float64
	CreatedAt    time.Time
}

// Delivery represents driver assignment and delivery details.
type Delivery struct {
	ID              uuid.UUID
	OrderID         uuid.UUID
	DriverID        *uuid.UUID
	PickupAt        *time.Time
	ArrivedAtPickup *time.Time
	DeliveredAt     *time.Time
	ProofImageURL   string
	SignatureURL    string
	Notes           string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// OrderStatusHistory tracks status transitions.
type OrderStatusHistory struct {
	ID        uuid.UUID
	OrderID   uuid.UUID
	OldStatus *OrderStatus
	NewStatus OrderStatus
	Reason    string
	UpdatedBy *uuid.UUID
	CreatedAt time.Time
}

// DeliveryRating represents a rating given to a driver.
type DeliveryRating struct {
	ID        uuid.UUID
	OrderID   uuid.UUID
	DriverID  uuid.UUID
	CustomerID uuid.UUID
	Rating    int
	Comment   string
	CreatedAt time.Time
}

// JSON type for Postgres JSONB (used for variants, images, etc.)
type JSON json.RawMessage

func (j JSON) Value() (driver.Value, error) {
	return json.RawMessage(j).MarshalJSON()
}

// NewOrder creates a new order.
func NewOrder(customerID uuid.UUID, orderType OrderType) *Order {
	return &Order{
		ID:         uuid.New(),
		CustomerID: customerID,
		Type:       orderType,
		Status:     OrderStatusPending,
		Currency:   "KES",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		Items:      []OrderItem{},
	}
}

// Transitions defines valid order status transitions.
var Transitions = map[OrderStatus][]OrderStatus{
	OrderStatusPending:        {OrderStatusAccepted, OrderStatusCancelled},
	OrderStatusAccepted:       {OrderStatusPreparing, OrderStatusCancelled},
	OrderStatusPreparing:      {OrderStatusReadyForPickup, OrderStatusCancelled},
	OrderStatusReadyForPickup: {OrderStatusDriverAssigned, OrderStatusCancelled},
	OrderStatusDriverAssigned: {OrderStatusPickedUp, OrderStatusCancelled},
	OrderStatusPickedUp:       {OrderStatusInTransit, OrderStatusCancelled},
	OrderStatusInTransit:      {OrderStatusDelivered, OrderStatusCancelled},
	OrderStatusDelivered:      {},
	OrderStatusCancelled:      {},
}

// CanTransitionTo checks if a status transition is valid.
func (o *Order) CanTransitionTo(newStatus OrderStatus) bool {
	validTransitions, exists := Transitions[o.Status]
	if !exists {
		return false
	}
	for _, valid := range validTransitions {
		if valid == newStatus {
			return true
		}
	}
	return false
}
