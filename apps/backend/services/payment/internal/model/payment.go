package model

import "time"

type Payment struct {
	ID                       string    `json:"id"`
	OrderID                  string    `json:"order_id"`
	CustomerID               string    `json:"customer_id"`
	DriverID                 *string   `json:"driver_id,omitempty"`
	MerchantID               *string   `json:"merchant_id,omitempty"`
	Amount                   float64   `json:"amount"`
	Currency                 string    `json:"currency"`
	PaymentMethod            string    `json:"payment_method"`
	Status                   string    `json:"status"`
	MpesaPhone               *string   `json:"mpesa_phone,omitempty"`
	MpesaCheckoutRequestID   *string   `json:"mpesa_checkout_request_id,omitempty"`
	MpesaMerchantRequestID   *string   `json:"mpesa_merchant_request_id,omitempty"`
	CreatedAt                time.Time `json:"created_at"`
	UpdatedAt                time.Time `json:"updated_at"`
}

type Transaction struct {
	ID            string    `json:"id"`
	PaymentID     string    `json:"payment_id"`
	RecipientID   string    `json:"recipient_id"`
	RecipientType string    `json:"recipient_type"`
	Type          string    `json:"type"`
	Amount        float64   `json:"amount"`
	Fee           float64   `json:"fee"`
	NetAmount     float64   `json:"net_amount"`
	MpesaReference *string   `json:"mpesa_reference,omitempty"`
	Status        string    `json:"status"`
	Description   string    `json:"description"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Escrow struct {
	ID        string     `json:"id"`
	PaymentID string     `json:"payment_id"`
	Amount    float64    `json:"amount"`
	HeldAt    time.Time  `json:"held_at"`
	ReleasedAt *time.Time `json:"released_at,omitempty"`
	ReleasedTo *string    `json:"released_to,omitempty"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
}

type MpesaCallback struct {
	ID                  string                 `json:"id"`
	PaymentID           *string                `json:"payment_id,omitempty"`
	TransactionID       string                 `json:"transaction_id"`
	CheckoutRequestID   string                 `json:"checkout_request_id"`
	MerchantRequestID   string                 `json:"merchant_request_id"`
	ResultCode          string                 `json:"result_code"`
	ResultDesc          string                 `json:"result_desc"`
	Amount              *float64               `json:"amount,omitempty"`
	MpesaReceiptNumber  *string                `json:"mpesa_receipt_number,omitempty"`
	PhoneNumber         *string                `json:"phone_number,omitempty"`
	Status              string                 `json:"status"`
	RawResponse         map[string]interface{} `json:"raw_response"`
	CreatedAt           time.Time              `json:"created_at"`
}

type DriverWallet struct {
	ID                string    `json:"id"`
	DriverID          string    `json:"driver_id"`
	AvailableBalance  float64   `json:"available_balance"`
	PendingBalance    float64   `json:"pending_balance"`
	LifetimeEarnings  float64   `json:"lifetime_earnings"`
	Currency          string    `json:"currency"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type DriverWithdrawal struct {
	ID             string     `json:"id"`
	DriverID       string     `json:"driver_id"`
	Amount         float64    `json:"amount"`
	Method         string     `json:"method"`
	Phone          string     `json:"phone"`
	Status         string     `json:"status"`
	MpesaReference *string    `json:"mpesa_reference,omitempty"`
	ErrorMessage   *string    `json:"error_message,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type InitiatePaymentRequest struct {
	OrderID        string  `json:"order_id" binding:"required"`
	CustomerID     string  `json:"customer_id" binding:"required"`
	Amount         float64 `json:"amount" binding:"required"`
	PaymentMethod  string  `json:"payment_method" binding:"required"` // mpesa, evc, zaad, sahal
	MpesaPhone     string  `json:"mpesa_phone"`
}

type ReleaseEscrowRequest struct {
	PaymentID string `json:"payment_id" binding:"required"`
	DriverID  string `json:"driver_id" binding:"required"`
}

type RefundRequest struct {
	PaymentID string `json:"payment_id" binding:"required"`
	Reason    string `json:"reason"`
}

type WithdrawalRequest struct {
	DriverID  string  `json:"driver_id" binding:"required"`
	Amount    float64 `json:"amount" binding:"required"`
	Method    string  `json:"method" binding:"required"`
	Phone     string  `json:"phone" binding:"required"`
}
