package service

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/payment/internal/model"
)

// ProcessWithdrawal handles driver withdrawal request (M-Pesa reverse)
func (ps *PaymentService) ProcessWithdrawal(ctx context.Context, withdrawalID, driverID string) error {
	log.Info().
		Str("withdrawal_id", withdrawalID).
		Str("driver_id", driverID).
		Msg("Processing withdrawal")

	// Get withdrawal
	withdrawals, err := ps.repo.GetWithdrawalHistory(ctx, driverID, 1)
	if err != nil || len(withdrawals) == 0 {
		log.Error().Err(err).Msg("Failed to get withdrawal")
		return fmt.Errorf("withdrawal not found")
	}

	withdrawal := withdrawals[0]

	if withdrawal.ID != withdrawalID {
		return fmt.Errorf("withdrawal ID mismatch")
	}

	// Get driver wallet
	wallet, err := ps.repo.GetDriverWallet(ctx, driverID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get driver wallet")
		return err
	}

	// Check sufficient balance
	if wallet.AvailableBalance < withdrawal.Amount {
		log.Warn().
			Str("driver_id", driverID).
			Float64("available", wallet.AvailableBalance).
			Float64("requested", withdrawal.Amount).
			Msg("Insufficient balance for withdrawal")

		_ = ps.repo.UpdateWithdrawalStatus(ctx, withdrawalID, "failed", "")
		return fmt.Errorf("insufficient balance")
	}

	// Process based on method
	var mpesaRef string
	var processErr error

	switch withdrawal.Method {
	case "mpesa":
		mpesaRef, processErr = ps.processMpesaWithdrawal(ctx, withdrawal)
	case "evc":
		// TODO: Implement EVC integration
		return fmt.Errorf("EVC withdrawal not yet implemented")
	case "zaad":
		// TODO: Implement Zaad integration
		return fmt.Errorf("Zaad withdrawal not yet implemented")
	case "sahal":
		// TODO: Implement Sahal integration
		return fmt.Errorf("Sahal withdrawal not yet implemented")
	default:
		return fmt.Errorf("unknown withdrawal method: %s", withdrawal.Method)
	}

	if processErr != nil {
		log.Error().Err(processErr).Msg("Withdrawal processing failed")
		_ = ps.repo.UpdateWithdrawalStatus(ctx, withdrawalID, "failed", "")
		return processErr
	}

	// Update wallet
	wallet.AvailableBalance -= withdrawal.Amount
	wallet.UpdatedAt = time.Now()

	if err := ps.repo.UpdateDriverWallet(ctx, wallet); err != nil {
		log.Error().Err(err).Msg("Failed to update driver wallet after withdrawal")
		return err
	}

	// Update withdrawal status
	if err := ps.repo.UpdateWithdrawalStatus(ctx, withdrawalID, "completed", mpesaRef); err != nil {
		log.Error().Err(err).Msg("Failed to update withdrawal status")
		return err
	}

	log.Info().
		Str("driver_id", driverID).
		Float64("amount", withdrawal.Amount).
		Str("method", withdrawal.Method).
		Str("mpesa_ref", mpesaRef).
		Float64("remaining_balance", wallet.AvailableBalance).
		Msg("Withdrawal completed successfully")

	return nil
}

// processMpesaWithdrawal handles M-Pesa reverse (money to driver)
func (ps *PaymentService) processMpesaWithdrawal(ctx context.Context, withdrawal *model.DriverWithdrawal) (string, error) {
	// TODO: Call M-Pesa B2C API (reverse transaction)
	// For now, generate a mock reference
	mockRef := fmt.Sprintf("WD%d", time.Now().Unix())

	log.Info().
		Str("driver_id", withdrawal.DriverID).
		Float64("amount", withdrawal.Amount).
		Str("phone", withdrawal.Phone).
		Str("reference", mockRef).
		Msg("M-Pesa B2C withdrawal initiated")

	return mockRef, nil
}

// ValidateWithdrawal checks if withdrawal is valid
func (ps *PaymentService) ValidateWithdrawal(ctx context.Context, driverID string, amount float64) error {
	if amount < 100 {
		return fmt.Errorf("minimum withdrawal amount is 100 KES")
	}

	if amount > 50000 {
		return fmt.Errorf("maximum withdrawal amount is 50,000 KES")
	}

	wallet, err := ps.repo.GetDriverWallet(ctx, driverID)
	if err != nil {
		return fmt.Errorf("wallet not found")
	}

	if wallet.AvailableBalance < amount {
		return fmt.Errorf("insufficient balance: %.2f available", wallet.AvailableBalance)
	}

	return nil
}
