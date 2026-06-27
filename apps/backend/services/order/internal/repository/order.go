package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/suqafuran/express/services/order/internal/model"
)

// OrderRepository defines order database operations.
type OrderRepository interface {
	CreateOrder(ctx context.Context, order *model.Order) error
	GetOrderByID(ctx context.Context, id uuid.UUID) (*model.Order, error)
	ListOrdersByCustomer(ctx context.Context, customerID uuid.UUID, limit, offset int) ([]*model.Order, int64, error)
	ListOrdersByMerchant(ctx context.Context, merchantID uuid.UUID, limit, offset int) ([]*model.Order, int64, error)
	UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, oldStatus, newStatus model.OrderStatus, reason string) error
	AddOrderItem(ctx context.Context, item *model.OrderItem) error
	GetDelivery(ctx context.Context, orderID uuid.UUID) (*model.Delivery, error)
	CreateDelivery(ctx context.Context, delivery *model.Delivery) error
	UpdateDelivery(ctx context.Context, delivery *model.Delivery) error
	RateDelivery(ctx context.Context, rating *model.DeliveryRating) error
}

// PostgresOrderRepository implements OrderRepository.
type PostgresOrderRepository struct {
	db *pgxpool.Pool
}

// NewPostgresOrderRepository creates a new postgres order repository.
func NewPostgresOrderRepository(db *pgxpool.Pool) *PostgresOrderRepository {
	return &PostgresOrderRepository{db: db}
}

// CreateOrder creates a new order.
func (r *PostgresOrderRepository) CreateOrder(ctx context.Context, order *model.Order) error {
	query := `
		INSERT INTO orders (id, customer_id, merchant_id, type, status, total_amount, delivery_fee, platform_fee,
			currency, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address,
			scheduled_at, special_instructions, payment_status, payment_method, customer_phone, customer_name,
			created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
		RETURNING id, created_at, updated_at
	`

	now := time.Now()
	err := r.db.QueryRow(ctx, query,
		order.ID,
		order.CustomerID,
		order.MerchantID,
		string(order.Type),
		string(order.Status),
		order.TotalAmount,
		order.DeliveryFee,
		order.PlatformFee,
		order.Currency,
		order.PickupLat,
		order.PickupLng,
		order.PickupAddress,
		order.DropoffLat,
		order.DropoffLng,
		order.DropoffAddress,
		order.ScheduledAt,
		order.SpecialInstructions,
		string(model.PaymentStatusPending),
		order.PaymentMethod,
		order.CustomerPhone,
		order.CustomerName,
		now,
		now,
	).Scan(&order.ID, &order.CreatedAt, &order.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create order: %w", err)
	}

	// Record initial status in history
	historyQuery := `
		INSERT INTO order_status_history (id, order_id, old_status, new_status, created_at)
		VALUES ($1, $2, NULL, $3, $4)
	`
	_, err = r.db.Exec(ctx, historyQuery, uuid.New(), order.ID, string(order.Status), now)
	if err != nil {
		return fmt.Errorf("failed to record status history: %w", err)
	}

	return nil
}

// GetOrderByID retrieves an order by ID.
func (r *PostgresOrderRepository) GetOrderByID(ctx context.Context, id uuid.UUID) (*model.Order, error) {
	query := `
		SELECT id, customer_id, merchant_id, type, status, total_amount, delivery_fee, platform_fee,
			currency, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address,
			scheduled_at, special_instructions, payment_status, payment_method, customer_phone, customer_name,
			created_at, updated_at
		FROM orders
		WHERE id = $1
	`

	order := &model.Order{}
	var typeStr, statusStr, paymentStatusStr string

	err := r.db.QueryRow(ctx, query, id).Scan(
		&order.ID,
		&order.CustomerID,
		&order.MerchantID,
		&typeStr,
		&statusStr,
		&order.TotalAmount,
		&order.DeliveryFee,
		&order.PlatformFee,
		&order.Currency,
		&order.PickupLat,
		&order.PickupLng,
		&order.PickupAddress,
		&order.DropoffLat,
		&order.DropoffLng,
		&order.DropoffAddress,
		&order.ScheduledAt,
		&order.SpecialInstructions,
		&paymentStatusStr,
		&order.PaymentMethod,
		&order.CustomerPhone,
		&order.CustomerName,
		&order.CreatedAt,
		&order.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("order not found")
		}
		return nil, fmt.Errorf("failed to get order: %w", err)
	}

	order.Type = model.OrderType(typeStr)
	order.Status = model.OrderStatus(statusStr)
	order.PaymentStatus = model.PaymentStatus(paymentStatusStr)

	// Load order items
	itemsQuery := `
		SELECT id, order_id, product_id, product_name, product_name_so, quantity, unit_price, subtotal, created_at
		FROM order_items
		WHERE order_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(ctx, itemsQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to load order items: %w", err)
	}
	defer rows.Close()

	items := []model.OrderItem{}
	for rows.Next() {
		item := model.OrderItem{}
		err := rows.Scan(
			&item.ID, &item.OrderID, &item.ProductID, &item.ProductName, &item.ProductNameSo,
			&item.Quantity, &item.UnitPrice, &item.Subtotal, &item.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan order item: %w", err)
		}
		items = append(items, item)
	}
	order.Items = items

	return order, nil
}

// ListOrdersByCustomer retrieves orders by customer.
func (r *PostgresOrderRepository) ListOrdersByCustomer(ctx context.Context, customerID uuid.UUID, limit, offset int) ([]*model.Order, int64, error) {
	countQuery := `SELECT COUNT(*) FROM orders WHERE customer_id = $1`
	var total int64
	err := r.db.QueryRow(ctx, countQuery, customerID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	query := `
		SELECT id, customer_id, merchant_id, type, status, total_amount, delivery_fee, platform_fee,
			currency, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address,
			scheduled_at, special_instructions, payment_status, payment_method, customer_phone, customer_name,
			created_at, updated_at
		FROM orders
		WHERE customer_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, customerID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list orders: %w", err)
	}
	defer rows.Close()

	orders := []*model.Order{}
	for rows.Next() {
		order := &model.Order{}
		var typeStr, statusStr, paymentStatusStr string

		err := rows.Scan(
			&order.ID, &order.CustomerID, &order.MerchantID, &typeStr, &statusStr,
			&order.TotalAmount, &order.DeliveryFee, &order.PlatformFee, &order.Currency,
			&order.PickupLat, &order.PickupLng, &order.PickupAddress,
			&order.DropoffLat, &order.DropoffLng, &order.DropoffAddress,
			&order.ScheduledAt, &order.SpecialInstructions, &paymentStatusStr, &order.PaymentMethod,
			&order.CustomerPhone, &order.CustomerName, &order.CreatedAt, &order.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan order: %w", err)
		}

		order.Type = model.OrderType(typeStr)
		order.Status = model.OrderStatus(statusStr)
		order.PaymentStatus = model.PaymentStatus(paymentStatusStr)
		orders = append(orders, order)
	}

	return orders, total, nil
}

// ListOrdersByMerchant retrieves orders by merchant.
func (r *PostgresOrderRepository) ListOrdersByMerchant(ctx context.Context, merchantID uuid.UUID, limit, offset int) ([]*model.Order, int64, error) {
	countQuery := `SELECT COUNT(*) FROM orders WHERE merchant_id = $1`
	var total int64
	err := r.db.QueryRow(ctx, countQuery, merchantID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	query := `
		SELECT id, customer_id, merchant_id, type, status, total_amount, delivery_fee, platform_fee,
			currency, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address,
			scheduled_at, special_instructions, payment_status, payment_method, customer_phone, customer_name,
			created_at, updated_at
		FROM orders
		WHERE merchant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, merchantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list orders: %w", err)
	}
	defer rows.Close()

	orders := []*model.Order{}
	for rows.Next() {
		order := &model.Order{}
		var typeStr, statusStr, paymentStatusStr string

		err := rows.Scan(
			&order.ID, &order.CustomerID, &order.MerchantID, &typeStr, &statusStr,
			&order.TotalAmount, &order.DeliveryFee, &order.PlatformFee, &order.Currency,
			&order.PickupLat, &order.PickupLng, &order.PickupAddress,
			&order.DropoffLat, &order.DropoffLng, &order.DropoffAddress,
			&order.ScheduledAt, &order.SpecialInstructions, &paymentStatusStr, &order.PaymentMethod,
			&order.CustomerPhone, &order.CustomerName, &order.CreatedAt, &order.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan order: %w", err)
		}

		order.Type = model.OrderType(typeStr)
		order.Status = model.OrderStatus(statusStr)
		order.PaymentStatus = model.PaymentStatus(paymentStatusStr)
		orders = append(orders, order)
	}

	return orders, total, nil
}

// UpdateOrderStatus updates an order status with history tracking.
func (r *PostgresOrderRepository) UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, oldStatus, newStatus model.OrderStatus, reason string) error {
	query := `UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`
	_, err := r.db.Exec(ctx, query, string(newStatus), time.Now(), orderID)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}

	// Record in history
	historyQuery := `
		INSERT INTO order_status_history (id, order_id, old_status, new_status, reason, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err = r.db.Exec(ctx, historyQuery, uuid.New(), orderID, string(oldStatus), string(newStatus), reason, time.Now())
	if err != nil {
		return fmt.Errorf("failed to record status history: %w", err)
	}

	return nil
}

// AddOrderItem adds an item to an order.
func (r *PostgresOrderRepository) AddOrderItem(ctx context.Context, item *model.OrderItem) error {
	query := `
		INSERT INTO order_items (id, order_id, product_id, product_name, product_name_so, quantity, unit_price, subtotal, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	item.ID = uuid.New()
	item.CreatedAt = time.Now()

	_, err := r.db.Exec(ctx, query,
		item.ID, item.OrderID, item.ProductID, item.ProductName, item.ProductNameSo,
		item.Quantity, item.UnitPrice, item.Subtotal, item.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to add order item: %w", err)
	}

	return nil
}

// GetDelivery retrieves delivery details for an order.
func (r *PostgresOrderRepository) GetDelivery(ctx context.Context, orderID uuid.UUID) (*model.Delivery, error) {
	query := `
		SELECT id, order_id, driver_id, pickup_at, arrived_at_pickup, delivered_at, proof_image_url, signature_url, notes, created_at, updated_at
		FROM deliveries
		WHERE order_id = $1
	`

	delivery := &model.Delivery{}
	err := r.db.QueryRow(ctx, query, orderID).Scan(
		&delivery.ID, &delivery.OrderID, &delivery.DriverID, &delivery.PickupAt, &delivery.ArrivedAtPickup,
		&delivery.DeliveredAt, &delivery.ProofImageURL, &delivery.SignatureURL, &delivery.Notes,
		&delivery.CreatedAt, &delivery.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No delivery yet
		}
		return nil, fmt.Errorf("failed to get delivery: %w", err)
	}

	return delivery, nil
}

// CreateDelivery creates a delivery record.
func (r *PostgresOrderRepository) CreateDelivery(ctx context.Context, delivery *model.Delivery) error {
	query := `
		INSERT INTO deliveries (id, order_id, driver_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	delivery.ID = uuid.New()
	now := time.Now()

	err := r.db.QueryRow(ctx, query, delivery.ID, delivery.OrderID, delivery.DriverID, now, now).
		Scan(&delivery.ID, &delivery.CreatedAt, &delivery.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create delivery: %w", err)
	}

	return nil
}

// UpdateDelivery updates delivery details.
func (r *PostgresOrderRepository) UpdateDelivery(ctx context.Context, delivery *model.Delivery) error {
	query := `
		UPDATE deliveries
		SET driver_id = $1, pickup_at = $2, arrived_at_pickup = $3, delivered_at = $4,
			proof_image_url = $5, signature_url = $6, notes = $7, updated_at = $8
		WHERE id = $9
	`

	_, err := r.db.Exec(ctx, query,
		delivery.DriverID, delivery.PickupAt, delivery.ArrivedAtPickup, delivery.DeliveredAt,
		delivery.ProofImageURL, delivery.SignatureURL, delivery.Notes, time.Now(), delivery.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update delivery: %w", err)
	}

	return nil
}

// RateDelivery adds a rating for a delivery.
func (r *PostgresOrderRepository) RateDelivery(ctx context.Context, rating *model.DeliveryRating) error {
	query := `
		INSERT INTO delivery_ratings (id, order_id, driver_id, customer_id, rating, comment, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	rating.ID = uuid.New()
	rating.CreatedAt = time.Now()

	_, err := r.db.Exec(ctx, query,
		rating.ID, rating.OrderID, rating.DriverID, rating.CustomerID, rating.Rating, rating.Comment, rating.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to rate delivery: %w", err)
	}

	return nil
}
