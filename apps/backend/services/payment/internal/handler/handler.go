package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/payment/config"
	"github.com/suqafuran/express/services/payment/internal/model"
	"github.com/suqafuran/express/services/payment/internal/repository"
	"github.com/suqafuran/express/services/payment/internal/service"
	"github.com/suqafuran/express/shared/pkg"
)

type PaymentHandler struct {
	repo           repository.PaymentRepository
	paymentService *service.PaymentService
	config         *config.Config
	nats           *nats.Conn
	redis          *redis.Client
}

func NewPaymentHandler(repo repository.PaymentRepository, cfg *config.Config, nc *nats.Conn, redis *redis.Client) *PaymentHandler {
	paymentSvc := service.NewPaymentService(repo, cfg)

	return &PaymentHandler{
		repo:           repo,
		paymentService: paymentSvc,
		config:         cfg,
		nats:           nc,
		redis:          redis,
	}
}

func (h *PaymentHandler) InitiatePayment(c *gin.Context) {
	userID := c.GetString("user_id")

	var req model.InitiatePaymentRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Invalid request"))
		return
	}

	// Validate required fields
	if req.OrderID == "" || req.CustomerID == "" || req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Missing required fields"))
		return
	}

	if req.PaymentMethod == "mpesa" && req.MpesaPhone == "" {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("M-Pesa phone number required"))
		return
	}

	log.Info().
		Str("user_id", userID).
		Str("order_id", req.OrderID).
		Str("payment_method", req.PaymentMethod).
		Float64("amount", req.Amount).
		Msg("Initiating payment")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	payment, err := h.paymentService.InitiatePayment(ctx, &req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to initiate payment")
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to initiate payment"))
		return
	}

	// Publish event to NATS
	eventData := map[string]interface{}{
		"payment_id":      payment.ID,
		"order_id":        payment.OrderID,
		"customer_id":     payment.CustomerID,
		"amount":          payment.Amount,
		"payment_method":  payment.PaymentMethod,
		"status":          payment.Status,
		"timestamp":       time.Now().Unix(),
	}

	eventBytes, _ := json.Marshal(eventData)
	_ = h.nats.Publish("payment.initiated", eventBytes)

	c.JSON(http.StatusCreated, pkg.SuccessResponse(map[string]interface{}{
		"id":                       payment.ID,
		"status":                   payment.Status,
		"mpesa_checkout_request_id": payment.MpesaCheckoutRequestID,
		"mpesa_merchant_request_id": payment.MpesaMerchantRequestID,
	}))
}

func (h *PaymentHandler) GetPayment(c *gin.Context) {
	paymentID := c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	payment, err := h.repo.GetPaymentByID(ctx, paymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("Payment not found"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(payment))
}

func (h *PaymentHandler) GetPaymentStatus(c *gin.Context) {
	paymentID := c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	payment, err := h.repo.GetPaymentByID(ctx, paymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("Payment not found"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
		"id":     payment.ID,
		"status": payment.Status,
	}))
}

func (h *PaymentHandler) RefundPayment(c *gin.Context) {
	paymentID := c.Param("id")

	var req model.RefundRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Invalid request"))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	payment, err := h.repo.GetPaymentByID(ctx, paymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("Payment not found"))
		return
	}

	if payment.Status != "paid" {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Only paid payments can be refunded"))
		return
	}

	// Update payment status
	if err := h.repo.UpdatePaymentStatus(ctx, paymentID, "refunded"); err != nil {
		log.Error().Err(err).Msg("Failed to refund payment")
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to refund payment"))
		return
	}

	// Create refund transaction
	refundTxn := &model.Transaction{
		PaymentID:     paymentID,
		RecipientID:   payment.CustomerID,
		RecipientType: "customer",
		Type:          "refund",
		Amount:        payment.Amount,
		Fee:           0,
		NetAmount:     payment.Amount,
		Status:        "completed",
		Description:   req.Reason,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := h.repo.CreateTransaction(ctx, refundTxn); err != nil {
		log.Error().Err(err).Msg("Failed to create refund transaction")
	}

	log.Info().Str("payment_id", paymentID).Msg("Payment refunded")

	c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
		"id":     paymentID,
		"status": "refunded",
	}))
}

func (h *PaymentHandler) ReleaseEscrow(c *gin.Context) {
	paymentID := c.Param("id")

	var req model.ReleaseEscrowRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Invalid request"))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := h.paymentService.ReleaseEscrowToDriver(ctx, paymentID, req.DriverID); err != nil {
		log.Error().Err(err).Msg("Failed to release escrow")
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to release escrow"))
		return
	}

	// Publish event to NATS
	eventData := map[string]interface{}{
		"payment_id": paymentID,
		"driver_id":  req.DriverID,
		"timestamp":  time.Now().Unix(),
	}

	eventBytes, _ := json.Marshal(eventData)
	_ = h.nats.Publish("escrow.released", eventBytes)

	c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
		"payment_id":  paymentID,
		"driver_id":   req.DriverID,
		"released_at": time.Now().Unix(),
	}))
}

func (h *PaymentHandler) HandleMpesaCallback(c *gin.Context) {
	// M-Pesa sends callback as application/x-www-form-urlencoded
	var body struct {
		Body struct {
			StkCallback struct {
				MerchantRequestID string `json:"MerchantRequestID"`
				CheckoutRequestID string `json:"CheckoutRequestID"`
				ResultCode        string `json:"ResultCode"`
				ResultDesc        string `json:"ResultDesc"`
				CallbackMetadata  struct {
					Item []struct {
						Name  string      `json:"Name"`
						Value interface{} `json:"Value"`
					} `json:"Item"`
				} `json:"CallbackMetadata"`
			} `json:"stkCallback"`
		} `json:"Body"`
	}

	if err := c.BindJSON(&body); err != nil {
		log.Warn().Err(err).Msg("Failed to parse M-Pesa callback")
		c.JSON(http.StatusOK, gin.H{"status": "received"})
		return
	}

	stk := body.Body.StkCallback

	log.Info().
		Str("merchant_request_id", stk.MerchantRequestID).
		Str("checkout_request_id", stk.CheckoutRequestID).
		Str("result_code", stk.ResultCode).
		Msg("Received M-Pesa callback")

	// Extract callback metadata
	var amount *float64
	var mpesaReceipt *string
	var phone *string

	for _, item := range stk.CallbackMetadata.Item {
		switch item.Name {
		case "Amount":
			if val, ok := item.Value.(float64); ok {
				amount = &val
			}
		case "MpesaReceiptNumber":
			if val, ok := item.Value.(string); ok {
				mpesaReceipt = &val
			}
		case "PhoneNumber":
			if val, ok := item.Value.(string); ok {
				phone = &val
			}
		}
	}

	// Look up payment by CheckoutRequestID
	// Note: In production, would query from database
	// For now, we'll need to store CheckoutRequestID → PaymentID mapping

	callback := &model.MpesaCallback{
		TransactionID:      stk.CheckoutRequestID,
		CheckoutRequestID:  stk.CheckoutRequestID,
		MerchantRequestID:  stk.MerchantRequestID,
		ResultCode:        stk.ResultCode,
		ResultDesc:         stk.ResultDesc,
		Amount:             amount,
		MpesaReceiptNumber: mpesaReceipt,
		PhoneNumber:        phone,
		Status:             "pending",
		CreatedAt:          time.Now(),
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := h.paymentService.ProcessPaymentCallback(ctx, callback); err != nil {
		log.Error().Err(err).Msg("Failed to process M-Pesa callback")
	}

	// Always return 200 to M-Pesa (don't retry)
	c.JSON(http.StatusOK, gin.H{"status": "received"})
}

func (h *PaymentHandler) GetDriverWallet(c *gin.Context) {
	driverID := c.Param("driver_id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	wallet, err := h.repo.GetDriverWallet(ctx, driverID)
	if err != nil {
		// Create wallet if not exists
		wallet = &model.DriverWallet{
			DriverID:         driverID,
			Currency:         "KES",
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
		}
		if err := h.repo.CreateDriverWallet(ctx, wallet); err != nil {
			log.Error().Err(err).Msg("Failed to create wallet")
			c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to get wallet"))
			return
		}
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(wallet))
}

func (h *PaymentHandler) RequestWithdrawal(c *gin.Context) {
	var req model.WithdrawalRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Invalid request"))
		return
	}

	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("Amount must be positive"))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	withdrawal := &model.DriverWithdrawal{
		DriverID:  req.DriverID,
		Amount:    req.Amount,
		Method:    req.Method,
		Phone:     req.Phone,
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := h.repo.CreateWithdrawal(ctx, withdrawal); err != nil {
		log.Error().Err(err).Msg("Failed to create withdrawal")
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to request withdrawal"))
		return
	}

	// Publish event to NATS
	eventData := map[string]interface{}{
		"withdrawal_id": withdrawal.ID,
		"driver_id":     req.DriverID,
		"amount":        req.Amount,
		"method":        req.Method,
		"timestamp":     time.Now().Unix(),
	}

	eventBytes, _ := json.Marshal(eventData)
	_ = h.nats.Publish("withdrawal.requested", eventBytes)

	log.Info().
		Str("driver_id", req.DriverID).
		Float64("amount", req.Amount).
		Str("method", req.Method).
		Msg("Withdrawal requested")

	c.JSON(http.StatusCreated, pkg.SuccessResponse(map[string]interface{}{
		"id":     withdrawal.ID,
		"status": withdrawal.Status,
	}))
}

func (h *PaymentHandler) GetWithdrawalHistory(c *gin.Context) {
	driverID := c.Param("driver_id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	withdrawals, err := h.repo.GetWithdrawalHistory(ctx, driverID, 50)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get withdrawal history")
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("Failed to get withdrawal history"))
		return
	}

	if withdrawals == nil {
		withdrawals = make([]*model.DriverWithdrawal, 0)
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(map[string]interface{}{
		"withdrawals": withdrawals,
	}))
}
