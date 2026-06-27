package service

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/payment/config"
	"github.com/suqafuran/express/services/payment/internal/integrations"
	"github.com/suqafuran/express/services/payment/internal/model"
	"github.com/suqafuran/express/services/payment/internal/repository"
)

type PaymentService struct {
	repo       repository.PaymentRepository
	mpesaClient *integrations.MpesaClient
	config     *config.Config
}

func NewPaymentService(repo repository.PaymentRepository, cfg *config.Config) *PaymentService {
	mpesaClient := integrations.NewMpesaClient(
		cfg.MpesaConsumerKey,
		cfg.MpesaConsumerSecret,
		cfg.MpesaBizShortCode,
		cfg.MpesaBizPasskey,
		cfg.MpesaLipanaURL,
		cfg.MpesaCallbackURL,
	)

	return &PaymentService{
		repo:        repo,
		mpesaClient: mpesaClient,
		config:      cfg,
	}
}

// InitiatePayment creates a payment and initiates M-Pesa STK push
func (ps *PaymentService) InitiatePayment(ctx context.Context, req *model.InitiatePaymentRequest) (*model.Payment, error) {
	// Create payment record
	payment := &model.Payment{
		OrderID:       req.OrderID,
		CustomerID:    req.CustomerID,
		Amount:        req.Amount,
		Currency:      "KES",
		PaymentMethod: req.PaymentMethod,
		Status:        "pending",
		MpesaPhone:    &req.MpesaPhone,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := ps.repo.CreatePayment(ctx, payment); err != nil {
		log.Error().Err(err).Str("order_id", req.OrderID).Msg("Failed to create payment record")
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}

	log.Info().
		Str("payment_id", payment.ID).
		Str("order_id", req.OrderID).
		Float64("amount", req.Amount).
		Msg("Payment record created")

	// Create escrow record to hold the payment
	escrow := &model.Escrow{
		PaymentID: payment.ID,
		Amount:    req.Amount,
		HeldAt:    time.Now(),
		Status:    "held",
		CreatedAt: time.Now(),
	}

	if err := ps.repo.CreateEscrow(ctx, escrow); err != nil {
		log.Error().Err(err).Str("payment_id", payment.ID).Msg("Failed to create escrow record")
		// Don't fail the whole operation, but log the error
	}

	log.Info().
		Str("escrow_id", escrow.ID).
		Str("payment_id", payment.ID).
		Float64("amount", req.Amount).
		Msg("Escrow record created")

	// Initiate M-Pesa STK push
	if req.PaymentMethod == "mpesa" {
		stkReq := ps.mpesaClient.BuildSTKPushRequest(
			int(req.Amount),
			req.MpesaPhone,
			req.OrderID,
			fmt.Sprintf("Order %s payment", req.OrderID),
		)

		stkResp, err := ps.mpesaClient.InitiateSTKPush(ctx, stkReq)
		if err != nil {
			log.Error().Err(err).
				Str("order_id", req.OrderID).
				Str("phone", req.MpesaPhone).
				Msg("Failed to initiate M-Pesa STK push")
			// Don't fail - customer can retry
			return payment, nil
		}

		// Store M-Pesa request IDs
		payment.MpesaCheckoutRequestID = &stkResp.CheckoutRequestID
		payment.MpesaMerchantRequestID = &stkResp.MerchantRequestID
		payment.UpdatedAt = time.Now()

		// Update payment with M-Pesa request IDs
		// Note: Would need to add update method to repository
		log.Info().
			Str("payment_id", payment.ID).
			Str("checkout_request_id", stkResp.CheckoutRequestID).
			Str("merchant_request_id", stkResp.MerchantRequestID).
			Msg("M-Pesa STK push initiated successfully")
	}

	return payment, nil
}

// ProcessPaymentCallback handles M-Pesa callback response
func (ps *PaymentService) ProcessPaymentCallback(ctx context.Context, callback *model.MpesaCallback) error {
	log.Info().
		Str("result_code", callback.ResultCode).
		Str("result_desc", callback.ResultDesc).
		Msg("Processing M-Pesa callback")

	// Store callback for audit trail
	if err := ps.repo.CreateMpesaCallback(ctx, callback); err != nil {
		log.Error().Err(err).Msg("Failed to store M-Pesa callback")
		return fmt.Errorf("failed to store callback: %w", err)
	}

	// Check result code (0 = success, other values = failure)
	if callback.ResultCode != "0" {
		log.Warn().
			Str("result_code", callback.ResultCode).
			Str("result_desc", callback.ResultDesc).
			Msg("M-Pesa payment failed")

		// Update payment status to failed
		if callback.PaymentID != nil {
			_ = ps.repo.UpdatePaymentStatus(ctx, *callback.PaymentID, "failed")
		}
		return nil
	}

	// Payment successful
	if callback.PaymentID == nil {
		log.Warn().Msg("No payment_id in successful M-Pesa callback")
		return nil
	}

	// Update payment status to paid
	if err := ps.repo.UpdatePaymentStatus(ctx, *callback.PaymentID, "paid"); err != nil {
		log.Error().Err(err).Str("payment_id", *callback.PaymentID).Msg("Failed to update payment status")
		return err
	}

	log.Info().
		Str("payment_id", *callback.PaymentID).
		Str("mpesa_receipt", *callback.MpesaReceiptNumber).
		Float64("amount", *callback.Amount).
		Msg("Payment marked as paid")

	// Create transaction record (charge to customer)
	if callback.Amount != nil {
		chargeTransaction := &model.Transaction{
			PaymentID:     *callback.PaymentID,
			RecipientID:   *callback.PaymentID, // Placeholder, will be driver
			RecipientType: "platform",
			Type:          "charge",
			Amount:        *callback.Amount,
			Fee:           0, // Full amount charged to customer
			NetAmount:     *callback.Amount,
			MpesaReference: callback.MpesaReceiptNumber,
			Status:        "completed",
			Description:   fmt.Sprintf("M-Pesa payment received: %s", *callback.MpesaReceiptNumber),
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}

		if err := ps.repo.CreateTransaction(ctx, chargeTransaction); err != nil {
			log.Error().Err(err).Str("payment_id", *callback.PaymentID).Msg("Failed to create charge transaction")
		}
	}

	// TODO: Publish payment.completed event to NATS
	// TODO: Notify customer via Notification Service

	return nil
}

// ReleaseEscrowToDriver releases held escrow to driver wallet after delivery
func (ps *PaymentService) ReleaseEscrowToDriver(ctx context.Context, paymentID, driverID string) error {
	log.Info().Str("payment_id", paymentID).Str("driver_id", driverID).Msg("Releasing escrow to driver")

	// Get payment
	payment, err := ps.repo.GetPaymentByID(ctx, paymentID)
	if err != nil {
		log.Error().Err(err).Str("payment_id", paymentID).Msg("Failed to get payment")
		return err
	}

	// Get escrow
	escrow, err := ps.repo.GetEscrowByPaymentID(ctx, paymentID)
	if err != nil {
		log.Error().Err(err).Str("payment_id", paymentID).Msg("Failed to get escrow")
		return err
	}

	// Release escrow
	if err := ps.repo.ReleaseEscrow(ctx, paymentID, driverID); err != nil {
		log.Error().Err(err).Str("payment_id", paymentID).Msg("Failed to release escrow")
		return err
	}

	log.Info().
		Str("payment_id", paymentID).
		Str("driver_id", driverID).
		Float64("amount", escrow.Amount).
		Msg("Escrow released successfully")

	// Create two transactions: driver revenue + platform fee
	driverShare := escrow.Amount * (1 - ps.config.PlatformFeePercent)
	platformFee := escrow.Amount * ps.config.PlatformFeePercent

	// Driver transaction
	driverTxn := &model.Transaction{
		PaymentID:     paymentID,
		RecipientID:   driverID,
		RecipientType: "driver",
		Type:          "payout",
		Amount:        driverShare,
		Fee:           0,
		NetAmount:     driverShare,
		Status:        "completed",
		Description:   fmt.Sprintf("Order %s delivery payment", payment.OrderID),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := ps.repo.CreateTransaction(ctx, driverTxn); err != nil {
		log.Error().Err(err).Str("payment_id", paymentID).Msg("Failed to create driver transaction")
		return err
	}

	// Platform transaction
	platformTxn := &model.Transaction{
		PaymentID:     paymentID,
		RecipientID:   "platform",
		RecipientType: "platform",
		Type:          "fee",
		Amount:        platformFee,
		Fee:           0,
		NetAmount:     platformFee,
		Status:        "completed",
		Description:   fmt.Sprintf("Order %s platform fee", payment.OrderID),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := ps.repo.CreateTransaction(ctx, platformTxn); err != nil {
		log.Error().Err(err).Str("payment_id", paymentID).Msg("Failed to create platform transaction")
		return err
	}

	log.Info().
		Str("payment_id", paymentID).
		Float64("driver_share", driverShare).
		Float64("platform_fee", platformFee).
		Msg("Transaction records created")

	// Update driver wallet
	wallet, err := ps.repo.GetDriverWallet(ctx, driverID)
	if err != nil {
		// Create new wallet if not exists
		wallet = &model.DriverWallet{
			DriverID:        driverID,
			AvailableBalance: driverShare,
			Currency:        "KES",
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
		if err := ps.repo.CreateDriverWallet(ctx, wallet); err != nil {
			log.Error().Err(err).Str("driver_id", driverID).Msg("Failed to create driver wallet")
			return err
		}
	} else {
		wallet.AvailableBalance += driverShare
		wallet.LifetimeEarnings += driverShare
		wallet.UpdatedAt = time.Now()
		if err := ps.repo.UpdateDriverWallet(ctx, wallet); err != nil {
			log.Error().Err(err).Str("driver_id", driverID).Msg("Failed to update driver wallet")
			return err
		}
	}

	log.Info().
		Str("driver_id", driverID).
		Float64("available_balance", wallet.AvailableBalance).
		Float64("lifetime_earnings", wallet.LifetimeEarnings).
		Msg("Driver wallet updated")

	// TODO: Publish escrow.released event to NATS
	// TODO: Notify driver via Notification Service

	return nil
}
