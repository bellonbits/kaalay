package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/suqafuran/express/services/notification/internal/model"
)

type NotificationRepository interface {
	CreateNotification(ctx context.Context, notif *model.Notification) error
	GetNotificationByID(ctx context.Context, id string) (*model.Notification, error)
	GetUserNotifications(ctx context.Context, userID string, limit, offset int) ([]*model.Notification, error)
	MarkAsRead(ctx context.Context, notificationID string) error
	CreateNotificationLog(ctx context.Context, log *model.NotificationLog) error
	GetOrCreatePreference(ctx context.Context, userID string) (*model.NotificationPreference, error)
	UpdatePreference(ctx context.Context, pref *model.NotificationPreference) error
}

type PostgresNotificationRepository struct {
	db *pgxpool.Pool
}

func NewPostgresNotificationRepository(db *pgxpool.Pool) *PostgresNotificationRepository {
	return &PostgresNotificationRepository{db: db}
}

func (r *PostgresNotificationRepository) CreateNotification(ctx context.Context, notif *model.Notification) error {
	query := `
		INSERT INTO notifications (recipient_id, event_type, title_en, title_so, body_en, body_so, template, order_id, driver_id, payment_id, data, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		notif.RecipientID,
		notif.EventType,
		notif.TitleEn,
		notif.TitleSo,
		notif.BodyEn,
		notif.BodySo,
		notif.Template,
		notif.OrderID,
		notif.DriverID,
		notif.PaymentID,
		notif.Data,
		notif.Status,
		notif.CreatedAt,
		notif.UpdatedAt,
	).Scan(&notif.ID)

	return err
}

func (r *PostgresNotificationRepository) GetNotificationByID(ctx context.Context, id string) (*model.Notification, error) {
	query := `
		SELECT id, recipient_id, event_type, title_en, title_so, body_en, body_so, template, order_id, driver_id, payment_id, data, status, sent_at, read_at, created_at, updated_at
		FROM notifications
		WHERE id = $1
	`

	notif := &model.Notification{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&notif.ID,
		&notif.RecipientID,
		&notif.EventType,
		&notif.TitleEn,
		&notif.TitleSo,
		&notif.BodyEn,
		&notif.BodySo,
		&notif.Template,
		&notif.OrderID,
		&notif.DriverID,
		&notif.PaymentID,
		&notif.Data,
		&notif.Status,
		&notif.SentAt,
		&notif.ReadAt,
		&notif.CreatedAt,
		&notif.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("notification not found")
		}
		return nil, err
	}

	return notif, nil
}

func (r *PostgresNotificationRepository) GetUserNotifications(ctx context.Context, userID string, limit, offset int) ([]*model.Notification, error) {
	query := `
		SELECT id, recipient_id, event_type, title_en, title_so, body_en, body_so, template, order_id, driver_id, payment_id, data, status, sent_at, read_at, created_at, updated_at
		FROM notifications
		WHERE recipient_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []*model.Notification
	for rows.Next() {
		notif := &model.Notification{}
		err := rows.Scan(
			&notif.ID,
			&notif.RecipientID,
			&notif.EventType,
			&notif.TitleEn,
			&notif.TitleSo,
			&notif.BodyEn,
			&notif.BodySo,
			&notif.Template,
			&notif.OrderID,
			&notif.DriverID,
			&notif.PaymentID,
			&notif.Data,
			&notif.Status,
			&notif.SentAt,
			&notif.ReadAt,
			&notif.CreatedAt,
			&notif.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		notifications = append(notifications, notif)
	}

	return notifications, rows.Err()
}

func (r *PostgresNotificationRepository) MarkAsRead(ctx context.Context, notificationID string) error {
	query := `
		UPDATE notifications
		SET status = 'read', read_at = $1, updated_at = $2
		WHERE id = $3
	`

	now := time.Now()
	_, err := r.db.Exec(ctx, query, now, now, notificationID)
	return err
}

func (r *PostgresNotificationRepository) CreateNotificationLog(ctx context.Context, log *model.NotificationLog) error {
	query := `
		INSERT INTO notification_logs (notification_id, channel, recipient, status, provider_response, error_message, sent_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		log.NotificationID,
		log.Channel,
		log.Recipient,
		log.Status,
		log.ProviderResponse,
		log.ErrorMessage,
		log.SentAt,
		log.CreatedAt,
	).Scan(&log.ID)

	return err
}

func (r *PostgresNotificationRepository) GetOrCreatePreference(ctx context.Context, userID string) (*model.NotificationPreference, error) {
	query := `
		INSERT INTO notification_preferences (user_id, push_enabled, sms_enabled, email_enabled, language, created_at, updated_at)
		VALUES ($1, true, true, true, 'en', $2, $2)
		ON CONFLICT (user_id) DO UPDATE SET updated_at = $2
		RETURNING id, user_id, push_enabled, sms_enabled, email_enabled, language, created_at, updated_at
	`

	pref := &model.NotificationPreference{}
	err := r.db.QueryRow(ctx, query, userID, time.Now()).Scan(
		&pref.ID,
		&pref.UserID,
		&pref.PushEnabled,
		&pref.SMSEnabled,
		&pref.EmailEnabled,
		&pref.Language,
		&pref.CreatedAt,
		&pref.UpdatedAt,
	)

	return pref, err
}

func (r *PostgresNotificationRepository) UpdatePreference(ctx context.Context, pref *model.NotificationPreference) error {
	query := `
		UPDATE notification_preferences
		SET push_enabled = $1, sms_enabled = $2, email_enabled = $3, language = $4, updated_at = $5
		WHERE user_id = $6
	`

	_, err := r.db.Exec(
		ctx,
		query,
		pref.PushEnabled,
		pref.SMSEnabled,
		pref.EmailEnabled,
		pref.Language,
		time.Now(),
		pref.UserID,
	)

	return err
}
