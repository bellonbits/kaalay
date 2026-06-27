package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/suqafuran/express/services/tracking/internal/model"
)

// TrackingRepository defines tracking database operations.
type TrackingRepository interface {
	RecordLocationHistory(ctx context.Context, location *model.DriverLocationHistory) error
	GetLocationHistory(ctx context.Context, driverID uuid.UUID, limit int) ([]*model.DriverLocationHistory, error)
	CreateWebSocketSession(ctx context.Context, session *model.WebSocketSession) error
	EndWebSocketSession(ctx context.Context, connectionID string) error
	GetActiveSession(ctx context.Context, connectionID string) (*model.WebSocketSession, error)
	CreateTrackingSubscription(ctx context.Context, sub *model.TrackingSubscription) error
	EndTrackingSubscription(ctx context.Context, subID uuid.UUID) error
	GetActiveSubscriptions(ctx context.Context, orderID uuid.UUID) ([]*model.TrackingSubscription, error)
}

// PostgresTrackingRepository implements TrackingRepository.
type PostgresTrackingRepository struct {
	db *pgxpool.Pool
}

// NewPostgresTrackingRepository creates a new postgres tracking repository.
func NewPostgresTrackingRepository(db *pgxpool.Pool) *PostgresTrackingRepository {
	return &PostgresTrackingRepository{db: db}
}

// RecordLocationHistory records a driver's location update.
func (r *PostgresTrackingRepository) RecordLocationHistory(ctx context.Context, location *model.DriverLocationHistory) error {
	query := `
		INSERT INTO driver_location_history (id, driver_id, lat, lng, accuracy, heading, speed, recorded_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	location.ID = uuid.New()
	location.CreatedAt = time.Now()

	_, err := r.db.Exec(ctx, query,
		location.ID, location.DriverID, location.Lat, location.Lng,
		location.Accuracy, location.Heading, location.Speed, location.RecordedAt, location.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to record location history: %w", err)
	}

	return nil
}

// GetLocationHistory retrieves location history for a driver.
func (r *PostgresTrackingRepository) GetLocationHistory(ctx context.Context, driverID uuid.UUID, limit int) ([]*model.DriverLocationHistory, error) {
	query := `
		SELECT id, driver_id, lat, lng, accuracy, heading, speed, recorded_at, created_at
		FROM driver_location_history
		WHERE driver_id = $1
		ORDER BY recorded_at DESC
		LIMIT $2
	`

	rows, err := r.db.Query(ctx, query, driverID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query location history: %w", err)
	}
	defer rows.Close()

	locations := []*model.DriverLocationHistory{}
	for rows.Next() {
		loc := &model.DriverLocationHistory{}
		err := rows.Scan(
			&loc.ID, &loc.DriverID, &loc.Lat, &loc.Lng,
			&loc.Accuracy, &loc.Heading, &loc.Speed, &loc.RecordedAt, &loc.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan location: %w", err)
		}
		locations = append(locations, loc)
	}

	return locations, nil
}

// CreateWebSocketSession creates a new WS session record.
func (r *PostgresTrackingRepository) CreateWebSocketSession(ctx context.Context, session *model.WebSocketSession) error {
	query := `
		INSERT INTO ws_sessions (id, user_id, connection_id, user_type, connected_at, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	session.ID = uuid.New()
	session.ConnectedAt = time.Now()
	session.IsActive = true

	_, err := r.db.Exec(ctx, query,
		session.ID, session.UserID, session.ConnectionID, session.UserType, session.ConnectedAt, session.IsActive,
	)

	if err != nil {
		return fmt.Errorf("failed to create websocket session: %w", err)
	}

	return nil
}

// EndWebSocketSession marks a session as ended.
func (r *PostgresTrackingRepository) EndWebSocketSession(ctx context.Context, connectionID string) error {
	query := `
		UPDATE ws_sessions
		SET is_active = false, disconnected_at = $1
		WHERE connection_id = $2
	`

	_, err := r.db.Exec(ctx, query, time.Now(), connectionID)

	if err != nil {
		return fmt.Errorf("failed to end websocket session: %w", err)
	}

	return nil
}

// GetActiveSession retrieves an active WS session.
func (r *PostgresTrackingRepository) GetActiveSession(ctx context.Context, connectionID string) (*model.WebSocketSession, error) {
	query := `
		SELECT id, user_id, connection_id, user_type, connected_at, disconnected_at, is_active
		FROM ws_sessions
		WHERE connection_id = $1 AND is_active = true
	`

	session := &model.WebSocketSession{}
	err := r.db.QueryRow(ctx, query, connectionID).Scan(
		&session.ID, &session.UserID, &session.ConnectionID, &session.UserType,
		&session.ConnectedAt, &session.DisconnectedAt, &session.IsActive,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return session, nil
}

// CreateTrackingSubscription creates a tracking subscription.
func (r *PostgresTrackingRepository) CreateTrackingSubscription(ctx context.Context, sub *model.TrackingSubscription) error {
	query := `
		INSERT INTO tracking_subscriptions (id, order_id, user_id, user_type, subscribed_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	sub.ID = uuid.New()
	sub.SubscribedAt = time.Now()

	_, err := r.db.Exec(ctx, query,
		sub.ID, sub.OrderID, sub.UserID, sub.UserType, sub.SubscribedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create tracking subscription: %w", err)
	}

	return nil
}

// EndTrackingSubscription ends a tracking subscription.
func (r *PostgresTrackingRepository) EndTrackingSubscription(ctx context.Context, subID uuid.UUID) error {
	query := `
		UPDATE tracking_subscriptions
		SET unsubscribed_at = $1
		WHERE id = $2
	`

	_, err := r.db.Exec(ctx, query, time.Now(), subID)

	if err != nil {
		return fmt.Errorf("failed to end tracking subscription: %w", err)
	}

	return nil
}

// GetActiveSubscriptions retrieves active subscriptions for an order.
func (r *PostgresTrackingRepository) GetActiveSubscriptions(ctx context.Context, orderID uuid.UUID) ([]*model.TrackingSubscription, error) {
	query := `
		SELECT id, order_id, user_id, user_type, subscribed_at, unsubscribed_at
		FROM tracking_subscriptions
		WHERE order_id = $1 AND unsubscribed_at IS NULL
	`

	rows, err := r.db.Query(ctx, query, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to query subscriptions: %w", err)
	}
	defer rows.Close()

	subs := []*model.TrackingSubscription{}
	for rows.Next() {
		sub := &model.TrackingSubscription{}
		err := rows.Scan(
			&sub.ID, &sub.OrderID, &sub.UserID, &sub.UserType, &sub.SubscribedAt, &sub.UnsubscribedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan subscription: %w", err)
		}
		subs = append(subs, sub)
	}

	return subs, nil
}
