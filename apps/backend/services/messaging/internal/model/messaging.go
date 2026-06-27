package model

import (
	"time"

	"github.com/google/uuid"
)

// Conversation represents a chat between two or more users.
type Conversation struct {
	ID              uuid.UUID
	Type            string      // customer_driver, customer_merchant, merchant_driver
	ParticipantIDs  []uuid.UUID // Array of user IDs
	OrderID         *uuid.UUID
	IsActive        bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// Message represents a single chat message.
type Message struct {
	ID             uuid.UUID
	ConversationID uuid.UUID
	SenderID       uuid.UUID
	SenderName     string
	Content        string
	MessageType    string // text, image, system
	ImageURL       *string
	ReadAt         *time.Time
	DeletedAt      *time.Time
	CreatedAt      time.Time
}

// ReadReceipt tracks when a user read a message.
type ReadReceipt struct {
	ID        uuid.UUID
	MessageID uuid.UUID
	ReaderID  uuid.UUID
	ReadAt    time.Time
}

// ConversationParticipant represents a user in a conversation.
type ConversationParticipant struct {
	ID                 uuid.UUID
	ConversationID     uuid.UUID
	UserID             uuid.UUID
	UserName           string
	JoinedAt           time.Time
	LastReadMessageID  *uuid.UUID
}

// TypingIndicator tracks when a user is typing.
type TypingIndicator struct {
	ID             uuid.UUID
	ConversationID uuid.UUID
	UserID         uuid.UUID
	TypingAt       time.Time
	ExpiresAt      time.Time
}

// NewConversation creates a new conversation.
func NewConversation(convType string, participantIDs []uuid.UUID, orderID *uuid.UUID) *Conversation {
	return &Conversation{
		ID:             uuid.New(),
		Type:           convType,
		ParticipantIDs: participantIDs,
		OrderID:        orderID,
		IsActive:       true,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
}

// NewMessage creates a new message.
func NewMessage(conversationID, senderID uuid.UUID, senderName, content string) *Message {
	return &Message{
		ID:             uuid.New(),
		ConversationID: conversationID,
		SenderID:       senderID,
		SenderName:     senderName,
		Content:        content,
		MessageType:    "text",
		CreatedAt:      time.Now(),
	}
}

// MessageDTO is the data transfer object for messages.
type MessageDTO struct {
	ID             uuid.UUID `json:"id"`
	ConversationID uuid.UUID `json:"conversation_id"`
	SenderID       uuid.UUID `json:"sender_id"`
	SenderName     string    `json:"sender_name"`
	Content        string    `json:"content"`
	MessageType    string    `json:"message_type"`
	ImageURL       *string   `json:"image_url,omitempty"`
	ReadAt         *int64    `json:"read_at,omitempty"`
	CreatedAt      int64     `json:"created_at"`
}

// ConversationDTO is the data transfer object for conversations.
type ConversationDTO struct {
	ID             uuid.UUID     `json:"id"`
	Type           string        `json:"type"`
	ParticipantIDs []uuid.UUID   `json:"participant_ids"`
	OrderID        *uuid.UUID    `json:"order_id,omitempty"`
	IsActive       bool          `json:"is_active"`
	Participants   []interface{} `json:"participants,omitempty"`
	LastMessage    *MessageDTO   `json:"last_message,omitempty"`
	CreatedAt      int64         `json:"created_at"`
}
