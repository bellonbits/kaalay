package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/suqafuran/express/services/payment/internal/model"
)

type PaymentRepository interface {
	CreatePayment(ctx context.Context, payment *model.Payment) error
	GetPaymentByID(ctx context.Context, id string) (*model.Payment, error)
	GetPaymentByOrderID(ctx context.Context, orderID string) (*model.Payment, error)
	UpdatePaymentStatus(ctx context.Context, id, status string) error
	CreateTransaction(ctx context.Context, txn *model.Transaction) error
	GetTransactionsByPaymentID(ctx context.Context, paymentID string) ([]*model.Transaction, error)
	CreateEscrow(ctx context.Context, escrow *model.Escrow) error
	GetEscrowByPaymentID(ctx context.Context, paymentID string) (*model.Escrow, error)
	ReleaseEscrow(ctx context.Context, paymentID, driverID string) error
	CreateMpesaCallback(ctx context.Context, callback *model.MpesaCallback) error
	GetMpesaCallbackByTransactionID(ctx context.Context, transactionID string) (*model.MpesaCallback, error)
	CreateDriverWallet(ctx context.Context, wallet *model.DriverWallet) error
	GetDriverWallet(ctx context.Context, driverID string) (*model.DriverWallet, error)
	UpdateDriverWallet(ctx context.Context, wallet *model.DriverWallet) error
	CreateWithdrawal(ctx context.Context, withdrawal *model.DriverWithdrawal) error
	GetWithdrawalHistory(ctx context.Context, driverID string, limit int) ([]*model.DriverWithdrawal, error)
	UpdateWithdrawalStatus(ctx context.Context, id, status, mpesaRef string) error
}

type PostgresPaymentRepository struct {
	db *pgxpool.Pool
}

func NewPostgresPaymentRepository(db *pgxpool.Pool) *PostgresPaymentRepository {
	return &PostgresPaymentRepository{db: db}
}

func (r *PostgresPaymentRepository) CreatePayment(ctx context.Context, payment *model.Payment) error {
	query := `
		INSERT INTO payments (order_id, customer_id, driver_id, merchant_id, amount, currency, payment_method, status, mpesa_phone, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		payment.OrderID,
		payment.CustomerID,
		payment.DriverID,
		payment.MerchantID,
		payment.Amount,
		payment.Currency,
		payment.PaymentMethod,
		payment.Status,
		payment.MpesaPhone,
		payment.CreatedAt,
		payment.UpdatedAt,
	).Scan(&payment.ID)

	return err
}

func (r *PostgresPaymentRepository) GetPaymentByID(ctx context.Context, id string) (*model.Payment, error) {
	query := `
		SELECT id, order_id, customer_id, driver_id, merchant_id, amount, currency, payment_method, status, mpesa_phone, mpesa_checkout_request_id, mpesa_merchant_request_id, created_at, updated_at
		FROM payments
		WHERE id = $1
	`

	payment := &model.Payment{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&payment.ID,
		&payment.OrderID,
		&payment.CustomerID,
		&payment.DriverID,
		&payment.MerchantID,
		&payment.Amount,
		&payment.Currency,
		&payment.PaymentMethod,
		&payment.Status,
		&payment.MpesaPhone,
		&payment.MpesaCheckoutRequestID,
		&payment.MpesaMerchantRequestID,
		&payment.CreatedAt,
		&payment.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("payment not found")
		}
		return nil, err
	}

	return payment, nil
}

func (r *PostgresPaymentRepository) GetPaymentByOrderID(ctx context.Context, orderID string) (*model.Payment, error) {
	query := `
		SELECT id, order_id, customer_id, driver_id, merchant_id, amount, currency, payment_method, status, mpesa_phone, mpesa_checkout_request_id, mpesa_merchant_request_id, created_at, updated_at
		FROM payments
		WHERE order_id = $1
	`

	payment := &model.Payment{}
	err := r.db.QueryRow(ctx, query, orderID).Scan(
		&payment.ID,
		&payment.OrderID,
		&payment.CustomerID,
		&payment.DriverID,
		&payment.MerchantID,
		&payment.Amount,
		&payment.Currency,
		&payment.PaymentMethod,
		&payment.Status,
		&payment.MpesaPhone,
		&payment.MpesaCheckoutRequestID,
		&payment.MpesaMerchantRequestID,
		&payment.CreatedAt,
		&payment.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("payment not found")
		}
		return nil, err
	}

	return payment, nil
}

func (r *PostgresPaymentRepository) UpdatePaymentStatus(ctx context.Context, id, status string) error {
	query := `
		UPDATE payments
		SET status = $1, updated_at = $2
		WHERE id = $3
	`

	_, err := r.db.Exec(ctx, query, status, time.Now(), id)
	return err
}

func (r *PostgresPaymentRepository) CreateTransaction(ctx context.Context, txn *model.Transaction) error {
	query := `
		INSERT INTO transactions (payment_id, recipient_id, recipient_type, type, amount, fee, net_amount, mpesa_reference, status, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		txn.PaymentID,
		txn.RecipientID,
		txn.RecipientType,
		txn.Type,
		txn.Amount,
		txn.Fee,
		txn.NetAmount,
		txn.MpesaReference,
		txn.Status,
		txn.Description,
		txn.CreatedAt,
		txn.UpdatedAt,
	).Scan(&txn.ID)

	return err
}

func (r *PostgresPaymentRepository) GetTransactionsByPaymentID(ctx context.Context, paymentID string) ([]*model.Transaction, error) {
	query := `
		SELECT id, payment_id, recipient_id, recipient_type, type, amount, fee, net_amount, mpesa_reference, status, description, created_at, updated_at
		FROM transactions
		WHERE payment_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(ctx, query, paymentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []*model.Transaction
	for rows.Next() {
		txn := &model.Transaction{}
		err := rows.Scan(
			&txn.ID,
			&txn.PaymentID,
			&txn.RecipientID,
			&txn.RecipientType,
			&txn.Type,
			&txn.Amount,
			&txn.Fee,
			&txn.NetAmount,
			&txn.MpesaReference,
			&txn.Status,
			&txn.Description,
			&txn.CreatedAt,
			&txn.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		transactions = append(transactions, txn)
	}

	return transactions, rows.Err()
}

func (r *PostgresPaymentRepository) CreateEscrow(ctx context.Context, escrow *model.Escrow) error {
	query := `
		INSERT INTO escrow (payment_id, amount, held_at, status, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		escrow.PaymentID,
		escrow.Amount,
		escrow.HeldAt,
		escrow.Status,
		escrow.CreatedAt,
	).Scan(&escrow.ID)

	return err
}

func (r *PostgresPaymentRepository) GetEscrowByPaymentID(ctx context.Context, paymentID string) (*model.Escrow, error) {
	query := `
		SELECT id, payment_id, amount, held_at, released_at, released_to, status, created_at
		FROM escrow
		WHERE payment_id = $1
	`

	escrow := &model.Escrow{}
	err := r.db.QueryRow(ctx, query, paymentID).Scan(
		&escrow.ID,
		&escrow.PaymentID,
		&escrow.Amount,
		&escrow.HeldAt,
		&escrow.ReleasedAt,
		&escrow.ReleasedTo,
		&escrow.Status,
		&escrow.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("escrow not found")
		}
		return nil, err
	}

	return escrow, nil
}

func (r *PostgresPaymentRepository) ReleaseEscrow(ctx context.Context, paymentID, driverID string) error {
	query := `
		UPDATE escrow
		SET status = 'released', released_at = $1, released_to = $2
		WHERE payment_id = $3
	`

	_, err := r.db.Exec(ctx, query, time.Now(), driverID, paymentID)
	return err
}

func (r *PostgresPaymentRepository) CreateMpesaCallback(ctx context.Context, callback *model.MpesaCallback) error {
	rawResp, _ := json.Marshal(callback.RawResponse)

	query := `
		INSERT INTO mpesa_callbacks (payment_id, transaction_id, checkout_request_id, merchant_request_id, result_code, result_desc, amount, mpesa_receipt_number, phone_number, status, raw_response, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		callback.PaymentID,
		callback.TransactionID,
		callback.CheckoutRequestID,
		callback.MerchantRequestID,
		callback.ResultCode,
		callback.ResultDesc,
		callback.Amount,
		callback.MpesaReceiptNumber,
		callback.PhoneNumber,
		callback.Status,
		rawResp,
		callback.CreatedAt,
	).Scan(&callback.ID)

	return err
}

func (r *PostgresPaymentRepository) GetMpesaCallbackByTransactionID(ctx context.Context, transactionID string) (*model.MpesaCallback, error) {
	query := `
		SELECT id, payment_id, transaction_id, checkout_request_id, merchant_request_id, result_code, result_desc, amount, mpesa_receipt_number, phone_number, status, raw_response, created_at
		FROM mpesa_callbacks
		WHERE transaction_id = $1
	`

	callback := &model.MpesaCallback{}
	var rawResp []byte

	err := r.db.QueryRow(ctx, query, transactionID).Scan(
		&callback.ID,
		&callback.PaymentID,
		&callback.TransactionID,
		&callback.CheckoutRequestID,
		&callback.MerchantRequestID,
		&callback.ResultCode,
		&callback.ResultDesc,
		&callback.Amount,
		&callback.MpesaReceiptNumber,
		&callback.PhoneNumber,
		&callback.Status,
		&rawResp,
		&callback.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("callback not found")
		}
		return nil, err
	}

	_ = json.Unmarshal(rawResp, &callback.RawResponse)
	return callback, nil
}

func (r *PostgresPaymentRepository) CreateDriverWallet(ctx context.Context, wallet *model.DriverWallet) error {
	query := `
		INSERT INTO driver_wallets (driver_id, available_balance, pending_balance, lifetime_earnings, currency, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		wallet.DriverID,
		wallet.AvailableBalance,
		wallet.PendingBalance,
		wallet.LifetimeEarnings,
		wallet.Currency,
		wallet.CreatedAt,
		wallet.UpdatedAt,
	).Scan(&wallet.ID)

	return err
}

func (r *PostgresPaymentRepository) GetDriverWallet(ctx context.Context, driverID string) (*model.DriverWallet, error) {
	query := `
		SELECT id, driver_id, available_balance, pending_balance, lifetime_earnings, currency, created_at, updated_at
		FROM driver_wallets
		WHERE driver_id = $1
	`

	wallet := &model.DriverWallet{}
	err := r.db.QueryRow(ctx, query, driverID).Scan(
		&wallet.ID,
		&wallet.DriverID,
		&wallet.AvailableBalance,
		&wallet.PendingBalance,
		&wallet.LifetimeEarnings,
		&wallet.Currency,
		&wallet.CreatedAt,
		&wallet.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("wallet not found")
		}
		return nil, err
	}

	return wallet, nil
}

func (r *PostgresPaymentRepository) UpdateDriverWallet(ctx context.Context, wallet *model.DriverWallet) error {
	query := `
		UPDATE driver_wallets
		SET available_balance = $1, pending_balance = $2, lifetime_earnings = $3, updated_at = $4
		WHERE driver_id = $5
	`

	_, err := r.db.Exec(
		ctx,
		query,
		wallet.AvailableBalance,
		wallet.PendingBalance,
		wallet.LifetimeEarnings,
		time.Now(),
		wallet.DriverID,
	)

	return err
}

func (r *PostgresPaymentRepository) CreateWithdrawal(ctx context.Context, withdrawal *model.DriverWithdrawal) error {
	query := `
		INSERT INTO driver_withdrawals (driver_id, amount, method, phone, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		withdrawal.DriverID,
		withdrawal.Amount,
		withdrawal.Method,
		withdrawal.Phone,
		withdrawal.Status,
		withdrawal.CreatedAt,
		withdrawal.UpdatedAt,
	).Scan(&withdrawal.ID)

	return err
}

func (r *PostgresPaymentRepository) GetWithdrawalHistory(ctx context.Context, driverID string, limit int) ([]*model.DriverWithdrawal, error) {
	query := `
		SELECT id, driver_id, amount, method, phone, status, mpesa_reference, error_message, created_at, updated_at
		FROM driver_withdrawals
		WHERE driver_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := r.db.Query(ctx, query, driverID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var withdrawals []*model.DriverWithdrawal
	for rows.Next() {
		w := &model.DriverWithdrawal{}
		err := rows.Scan(
			&w.ID,
			&w.DriverID,
			&w.Amount,
			&w.Method,
			&w.Phone,
			&w.Status,
			&w.MpesaReference,
			&w.ErrorMessage,
			&w.CreatedAt,
			&w.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		withdrawals = append(withdrawals, w)
	}

	return withdrawals, rows.Err()
}

func (r *PostgresPaymentRepository) UpdateWithdrawalStatus(ctx context.Context, id, status, mpesaRef string) error {
	query := `
		UPDATE driver_withdrawals
		SET status = $1, mpesa_reference = $2, updated_at = $3
		WHERE id = $4
	`

	_, err := r.db.Exec(ctx, query, status, mpesaRef, time.Now(), id)
	return err
}

func (r *PostgresPaymentRepository) UpdatePaymentWithMpesaDetails(ctx context.Context, id, checkoutReqID, merchantReqID string) error {
	query := `
		UPDATE payments
		SET mpesa_checkout_request_id = $1, mpesa_merchant_request_id = $2, updated_at = $3
		WHERE id = $4
	`

	_, err := r.db.Exec(ctx, query, checkoutReqID, merchantReqID, time.Now(), id)
	return err
}
