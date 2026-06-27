package model

import "time"

type NotificationPreference struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	PushEnabled   bool      `json:"push_enabled"`
	SMSEnabled    bool      `json:"sms_enabled"`
	EmailEnabled  bool      `json:"email_enabled"`
	Language      string    `json:"language"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Notification struct {
	ID         string                 `json:"id"`
	RecipientID string                `json:"recipient_id"`
	EventType  string                 `json:"event_type"`
	TitleEn    string                 `json:"title_en"`
	TitleSo    string                 `json:"title_so,omitempty"`
	BodyEn     string                 `json:"body_en"`
	BodySo     string                 `json:"body_so,omitempty"`
	Template   string                 `json:"template,omitempty"`
	OrderID    *string                `json:"order_id,omitempty"`
	DriverID   *string                `json:"driver_id,omitempty"`
	PaymentID  *string                `json:"payment_id,omitempty"`
	Data       map[string]interface{} `json:"data"`
	Status     string                 `json:"status"`
	SentAt     *time.Time             `json:"sent_at,omitempty"`
	ReadAt     *time.Time             `json:"read_at,omitempty"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

type NotificationLog struct {
	ID               string     `json:"id"`
	NotificationID   string     `json:"notification_id"`
	Channel          string     `json:"channel"`
	Recipient        string     `json:"recipient"`
	Status           string     `json:"status"`
	ProviderResponse string     `json:"provider_response,omitempty"`
	ErrorMessage     string     `json:"error_message,omitempty"`
	SentAt           *time.Time `json:"sent_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
}

type SendNotificationRequest struct {
	RecipientID string                 `json:"recipient_id" binding:"required"`
	EventType   string                 `json:"event_type" binding:"required"`
	TitleEn     string                 `json:"title_en" binding:"required"`
	TitleSo     string                 `json:"title_so"`
	BodyEn      string                 `json:"body_en" binding:"required"`
	BodySo      string                 `json:"body_so"`
	Template    string                 `json:"template"`
	OrderID     *string                `json:"order_id"`
	DriverID    *string                `json:"driver_id"`
	PaymentID   *string                `json:"payment_id"`
	Data        map[string]interface{} `json:"data"`
}
