package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/suqafuran/express/services/messaging/internal/model"
)

type ConversationRepository interface {
	Create(ctx context.Context, conv *model.Conversation) error
	GetByID(ctx context.Context, id string) (*model.Conversation, error)
	GetUserConversations(ctx context.Context, userID string) ([]*model.Conversation, error)
	GetByOrderID(ctx context.Context, orderID string) (*model.Conversation, error)
	UpdateIsActive(ctx context.Context, id string, isActive bool) error
}

type MessageRepository interface {
	CreateMessage(ctx context.Context, msg *model.Message) error
	GetByConversationID(ctx context.Context, conversationID string, limit, offset int) ([]*model.Message, error)
	GetMessageByID(ctx context.Context, id string) (*model.Message, error)
	SoftDelete(ctx context.Context, id string) error
	GetUnreadCount(ctx context.Context, conversationID, userID string) (int, error)
}

type ReadReceiptRepository interface {
	CreateReadReceipt(ctx context.Context, receipt *model.ReadReceipt) error
	GetReceiptsByMessageID(ctx context.Context, messageID string) ([]*model.ReadReceipt, error)
	GetUnreadMessages(ctx context.Context, conversationID, userID string) ([]string, error)
}

type TypingIndicatorRepository interface {
	CreateTypingIndicator(ctx context.Context, indicator *model.TypingIndicator) error
	GetActiveTypingIndicators(ctx context.Context, conversationID string) ([]*model.TypingIndicator, error)
	DeleteExpiredTypingIndicators(ctx context.Context) error
	DeleteTypingIndicator(ctx context.Context, conversationID, userID string) error
}

type ConversationParticipantRepository interface {
	CreateParticipant(ctx context.Context, participant *model.ConversationParticipant) error
	GetParticipants(ctx context.Context, conversationID string) ([]*model.ConversationParticipant, error)
	UpdateLastReadMessage(ctx context.Context, conversationID, userID, messageID string) error
}

type MessagingRepository interface {
	ConversationRepository
	MessageRepository
	ReadReceiptRepository
	TypingIndicatorRepository
	ConversationParticipantRepository
}

// PostgresMessagingRepository implements all repository interfaces
type PostgresMessagingRepository struct {
	db *pgxpool.Pool
}

func NewPostgresMessagingRepository(db *pgxpool.Pool) *PostgresMessagingRepository {
	return &PostgresMessagingRepository{db: db}
}

// ============= Conversation Repository =============

func (r *PostgresMessagingRepository) Create(ctx context.Context, conv *model.Conversation) error {
	query := `
		INSERT INTO conversations (type, participant_ids, order_id, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		conv.Type,
		conv.ParticipantIDs,
		conv.OrderID,
		conv.IsActive,
		conv.CreatedAt,
		conv.UpdatedAt,
	).Scan(&conv.ID)

	if err != nil {
		return err
	}

	return nil
}

func (r *PostgresMessagingRepository) GetByID(ctx context.Context, id string) (*model.Conversation, error) {
	query := `
		SELECT id, type, participant_ids, order_id, is_active, created_at, updated_at
		FROM conversations
		WHERE id = $1
	`

	conv := &model.Conversation{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&conv.ID,
		&conv.Type,
		&conv.ParticipantIDs,
		&conv.OrderID,
		&conv.IsActive,
		&conv.CreatedAt,
		&conv.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("conversation not found")
		}
		return nil, err
	}

	return conv, nil
}

func (r *PostgresMessagingRepository) GetUserConversations(ctx context.Context, userID string) ([]*model.Conversation, error) {
	query := `
		SELECT id, type, participant_ids, order_id, is_active, created_at, updated_at
		FROM conversations
		WHERE $1 = ANY(participant_ids) AND is_active = true
		ORDER BY updated_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var conversations []*model.Conversation
	for rows.Next() {
		conv := &model.Conversation{}
		err := rows.Scan(
			&conv.ID,
			&conv.Type,
			&conv.ParticipantIDs,
			&conv.OrderID,
			&conv.IsActive,
			&conv.CreatedAt,
			&conv.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		conversations = append(conversations, conv)
	}

	return conversations, rows.Err()
}

func (r *PostgresMessagingRepository) GetByOrderID(ctx context.Context, orderID string) (*model.Conversation, error) {
	query := `
		SELECT id, type, participant_ids, order_id, is_active, created_at, updated_at
		FROM conversations
		WHERE order_id = $1
		LIMIT 1
	`

	conv := &model.Conversation{}
	err := r.db.QueryRow(ctx, query, orderID).Scan(
		&conv.ID,
		&conv.Type,
		&conv.ParticipantIDs,
		&conv.OrderID,
		&conv.IsActive,
		&conv.CreatedAt,
		&conv.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("conversation not found")
		}
		return nil, err
	}

	return conv, nil
}

func (r *PostgresMessagingRepository) UpdateIsActive(ctx context.Context, id string, isActive bool) error {
	query := `
		UPDATE conversations
		SET is_active = $1, updated_at = $2
		WHERE id = $3
	`

	_, err := r.db.Exec(ctx, query, isActive, time.Now(), id)
	return err
}

// ============= Message Repository =============

func (r *PostgresMessagingRepository) CreateMessage(ctx context.Context, msg *model.Message) error {
	query := `
		INSERT INTO messages (conversation_id, sender_id, sender_name, content, message_type, image_url, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		msg.ConversationID,
		msg.SenderID,
		msg.SenderName,
		msg.Content,
		msg.MessageType,
		msg.ImageURL,
		msg.CreatedAt,
	).Scan(&msg.ID)

	return err
}

func (r *PostgresMessagingRepository) GetByConversationID(ctx context.Context, conversationID string, limit, offset int) ([]*model.Message, error) {
	query := `
		SELECT id, conversation_id, sender_id, sender_name, content, message_type, image_url, read_at, deleted_at, created_at
		FROM messages
		WHERE conversation_id = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, conversationID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []*model.Message
	for rows.Next() {
		msg := &model.Message{}
		err := rows.Scan(
			&msg.ID,
			&msg.ConversationID,
			&msg.SenderID,
			&msg.SenderName,
			&msg.Content,
			&msg.MessageType,
			&msg.ImageURL,
			&msg.ReadAt,
			&msg.DeletedAt,
			&msg.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	// Reverse to get chronological order (we queried DESC)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, rows.Err()
}

func (r *PostgresMessagingRepository) GetMessageByID(ctx context.Context, id string) (*model.Message, error) {
	query := `
		SELECT id, conversation_id, sender_id, sender_name, content, message_type, image_url, read_at, deleted_at, created_at
		FROM messages
		WHERE id = $1
	`

	msg := &model.Message{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&msg.ID,
		&msg.ConversationID,
		&msg.SenderID,
		&msg.SenderName,
		&msg.Content,
		&msg.MessageType,
		&msg.ImageURL,
		&msg.ReadAt,
		&msg.DeletedAt,
		&msg.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("message not found")
		}
		return nil, err
	}

	return msg, nil
}

func (r *PostgresMessagingRepository) SoftDelete(ctx context.Context, id string) error {
	query := `
		UPDATE messages
		SET deleted_at = $1
		WHERE id = $2
	`

	_, err := r.db.Exec(ctx, query, time.Now(), id)
	return err
}

func (r *PostgresMessagingRepository) GetUnreadCount(ctx context.Context, conversationID, userID string) (int, error) {
	query := `
		SELECT COUNT(DISTINCT m.id)
		FROM messages m
		LEFT JOIN read_receipts rr ON m.id = rr.message_id AND rr.reader_id = $2
		WHERE m.conversation_id = $1
		  AND m.sender_id != $2
		  AND m.deleted_at IS NULL
		  AND rr.id IS NULL
	`

	var count int
	err := r.db.QueryRow(ctx, query, conversationID, userID).Scan(&count)
	return count, err
}

// ============= Read Receipt Repository =============

func (r *PostgresMessagingRepository) CreateReadReceipt(ctx context.Context, receipt *model.ReadReceipt) error {
	query := `
		INSERT INTO read_receipts (message_id, reader_id, read_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (message_id, reader_id) DO NOTHING
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		receipt.MessageID,
		receipt.ReaderID,
		receipt.ReadAt,
	).Scan(&receipt.ID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // Already read, not an error
		}
		return err
	}

	return nil
}

func (r *PostgresMessagingRepository) GetReceiptsByMessageID(ctx context.Context, messageID string) ([]*model.ReadReceipt, error) {
	query := `
		SELECT id, message_id, reader_id, read_at
		FROM read_receipts
		WHERE message_id = $1
		ORDER BY read_at ASC
	`

	rows, err := r.db.Query(ctx, query, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var receipts []*model.ReadReceipt
	for rows.Next() {
		receipt := &model.ReadReceipt{}
		err := rows.Scan(
			&receipt.ID,
			&receipt.MessageID,
			&receipt.ReaderID,
			&receipt.ReadAt,
		)
		if err != nil {
			return nil, err
		}
		receipts = append(receipts, receipt)
	}

	return receipts, rows.Err()
}

func (r *PostgresMessagingRepository) GetUnreadMessages(ctx context.Context, conversationID, userID string) ([]string, error) {
	query := `
		SELECT DISTINCT m.id
		FROM messages m
		LEFT JOIN read_receipts rr ON m.id = rr.message_id AND rr.reader_id = $2
		WHERE m.conversation_id = $1
		  AND m.sender_id != $2
		  AND m.deleted_at IS NULL
		  AND rr.id IS NULL
		ORDER BY m.created_at ASC
	`

	rows, err := r.db.Query(ctx, query, conversationID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messageIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		messageIDs = append(messageIDs, id)
	}

	return messageIDs, rows.Err()
}

// ============= Typing Indicator Repository =============

func (r *PostgresMessagingRepository) CreateTypingIndicator(ctx context.Context, indicator *model.TypingIndicator) error {
	query := `
		INSERT INTO typing_indicators (conversation_id, user_id, typing_at, expires_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT DO NOTHING
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		indicator.ConversationID,
		indicator.UserID,
		indicator.TypingAt,
		indicator.ExpiresAt,
	).Scan(&indicator.ID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}

	return nil
}

func (r *PostgresMessagingRepository) GetActiveTypingIndicators(ctx context.Context, conversationID string) ([]*model.TypingIndicator, error) {
	query := `
		SELECT id, conversation_id, user_id, typing_at, expires_at
		FROM typing_indicators
		WHERE conversation_id = $1 AND expires_at > now()
		ORDER BY typing_at DESC
	`

	rows, err := r.db.Query(ctx, query, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var indicators []*model.TypingIndicator
	for rows.Next() {
		indicator := &model.TypingIndicator{}
		err := rows.Scan(
			&indicator.ID,
			&indicator.ConversationID,
			&indicator.UserID,
			&indicator.TypingAt,
			&indicator.ExpiresAt,
		)
		if err != nil {
			return nil, err
		}
		indicators = append(indicators, indicator)
	}

	return indicators, rows.Err()
}

func (r *PostgresMessagingRepository) DeleteExpiredTypingIndicators(ctx context.Context) error {
	query := `DELETE FROM typing_indicators WHERE expires_at <= now()`
	_, err := r.db.Exec(ctx, query)
	return err
}

func (r *PostgresMessagingRepository) DeleteTypingIndicator(ctx context.Context, conversationID, userID string) error {
	query := `
		DELETE FROM typing_indicators
		WHERE conversation_id = $1 AND user_id = $2
	`

	_, err := r.db.Exec(ctx, query, conversationID, userID)
	return err
}

// ============= Conversation Participant Repository =============

func (r *PostgresMessagingRepository) CreateParticipant(ctx context.Context, participant *model.ConversationParticipant) error {
	query := `
		INSERT INTO conversation_participants (conversation_id, user_id, user_name, joined_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (conversation_id, user_id) DO NOTHING
		RETURNING id
	`

	err := r.db.QueryRow(
		ctx,
		query,
		participant.ConversationID,
		participant.UserID,
		participant.UserName,
		participant.JoinedAt,
	).Scan(&participant.ID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}

	return nil
}

func (r *PostgresMessagingRepository) GetParticipants(ctx context.Context, conversationID string) ([]*model.ConversationParticipant, error) {
	query := `
		SELECT id, conversation_id, user_id, user_name, joined_at, last_read_message_id
		FROM conversation_participants
		WHERE conversation_id = $1
		ORDER BY joined_at ASC
	`

	rows, err := r.db.Query(ctx, query, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var participants []*model.ConversationParticipant
	for rows.Next() {
		participant := &model.ConversationParticipant{}
		err := rows.Scan(
			&participant.ID,
			&participant.ConversationID,
			&participant.UserID,
			&participant.UserName,
			&participant.JoinedAt,
			&participant.LastReadMessageID,
		)
		if err != nil {
			return nil, err
		}
		participants = append(participants, participant)
	}

	return participants, rows.Err()
}

func (r *PostgresMessagingRepository) UpdateLastReadMessage(ctx context.Context, conversationID, userID, messageID string) error {
	query := `
		UPDATE conversation_participants
		SET last_read_message_id = $1
		WHERE conversation_id = $2 AND user_id = $3
	`

	_, err := r.db.Exec(ctx, query, messageID, conversationID, userID)
	return err
}
