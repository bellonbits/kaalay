package model

import (
	"time"

	"github.com/google/uuid"
)

// LocationUpdate represents a driver's GPS location.
type LocationUpdate struct {
	DriverID   uuid.UUID
	Lat        float64
	Lng        float64
	Accuracy   int // meters
	Heading    int // 0-360 degrees
	Speed      float64
	Timestamp  time.Time
}

// DriverLocationHistory stores historical location data for analytics.
type DriverLocationHistory struct {
	ID        uuid.UUID
	DriverID  uuid.UUID
	Lat       float64
	Lng       float64
	Accuracy  int
	Heading   int
	Speed     float64
	RecordedAt time.Time
	CreatedAt time.Time
}

// WebSocketSession tracks active connections.
type WebSocketSession struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	ConnectionID string
	UserType     string // driver, customer, merchant
	ConnectedAt  time.Time
	DisconnectedAt *time.Time
	IsActive     bool
}

// TrackingSubscription tracks who is tracking which orders.
type TrackingSubscription struct {
	ID            uuid.UUID
	OrderID       uuid.UUID
	UserID        uuid.UUID
	UserType      string // customer, merchant, driver
	SubscribedAt  time.Time
	UnsubscribedAt *time.Time
}

// WebSocketMessage represents a message sent over WebSocket.
type WebSocketMessage struct {
	Type string      `json:"type"` // driver_location, order_status, join, leave, error
	Data interface{} `json:"data"`
}

// DriverLocationMessage is sent to tracking subscribers.
type DriverLocationMessage struct {
	Type           string    `json:"type"`
	OrderID        string    `json:"order_id"`
	DriverID       string    `json:"driver_id"`
	Lat            float64   `json:"lat"`
	Lng            float64   `json:"lng"`
	Heading        int       `json:"heading"`
	Speed          float64   `json:"speed"`
	Accuracy       int       `json:"accuracy"`
	Timestamp      int64     `json:"timestamp"`
	ETA            *int      `json:"eta_seconds,omitempty"` // Estimated time to arrival
}

// OrderStatusMessage is sent when order status changes.
type OrderStatusMessage struct {
	Type      string `json:"type"`
	OrderID   string `json:"order_id"`
	OldStatus string `json:"old_status"`
	NewStatus string `json:"new_status"`
	Timestamp int64  `json:"timestamp"`
}

// JoinMessage is sent when user joins a tracking room.
type JoinMessage struct {
	Type     string `json:"type"`
	RoomID   string `json:"room_id"` // order_id
	UserID   string `json:"user_id"`
	UserType string `json:"user_type"` // driver, customer, merchant
	Message  string `json:"message"`
}

// LeaveMessage is sent when user leaves a tracking room.
type LeaveMessage struct {
	Type     string `json:"type"`
	RoomID   string `json:"room_id"`
	UserID   string `json:"user_id"`
	Message  string `json:"message"`
}

// ErrorMessage is sent on errors.
type ErrorMessage struct {
	Type    string `json:"type"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// NewLocationUpdate creates a new location update.
func NewLocationUpdate(driverID uuid.UUID, lat, lng float64) *LocationUpdate {
	return &LocationUpdate{
		DriverID:  driverID,
		Lat:       lat,
		Lng:       lng,
		Timestamp: time.Now(),
	}
}

// NewTrackingSubscription creates a new subscription.
func NewTrackingSubscription(orderID, userID uuid.UUID, userType string) *TrackingSubscription {
	return &TrackingSubscription{
		ID:           uuid.New(),
		OrderID:      orderID,
		UserID:       userID,
		UserType:     userType,
		SubscribedAt: time.Now(),
	}
}
