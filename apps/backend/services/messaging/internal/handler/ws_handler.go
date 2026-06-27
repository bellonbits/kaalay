package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/messaging/internal/model"
	"github.com/suqafuran/express/services/messaging/internal/repository"
	"nhooyr.io/websocket"
)

type WSHandler struct {
	repo repository.MessagingRepository
	hubs map[string]*ConversationHub
}

type ConversationHub struct {
	conversationID string
	connections    map[string]*WSConnection
	broadcast      chan interface{}
	subscribe      chan *WSConnection
	unsubscribe    chan *WSConnection
	repo           repository.MessagingRepository
}

type WSConnection struct {
	ID              string
	UserID          string
	UserName        string
	ConversationID  string
	conn            *websocket.Conn
	send            chan interface{}
}

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type MessagePayload struct {
	Content   string `json:"content"`
	Type      string `json:"type"` // text, image
	ImageURL  string `json:"image_url,omitempty"`
}

type TypingPayload struct {
	IsTyping bool `json:"is_typing"`
}

type ReadPayload struct {
	MessageID string `json:"message_id"`
}

type LocationPayload struct {
	UserID   string `json:"user_id"`
	UserName string `json:"user_name"`
}

func NewWSHandler(repo repository.MessagingRepository) *WSHandler {
	return &WSHandler{
		repo: repo,
		hubs: make(map[string]*ConversationHub),
	}
}

func (h *WSHandler) HandleConnection(c *gin.Context) {
	conversationID := c.Param("conversation_id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")

	conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{})
	if err != nil {
		log.Error().Err(err).Str("conversation_id", conversationID).Msg("Failed to accept WebSocket")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to upgrade connection"})
		return
	}

	log.Info().
		Str("user_id", userID).
		Str("conversation_id", conversationID).
		Msg("User connected to conversation")

	hub := h.getOrCreateHub(conversationID)

	connection := &WSConnection{
		ID:             userID,
		UserID:         userID,
		UserName:       userName,
		ConversationID: conversationID,
		conn:           conn,
		send:           make(chan interface{}, 256),
	}

	hub.subscribe <- connection

	go connection.readPump(hub)
	go connection.writePump()
}

func (h *WSHandler) getOrCreateHub(conversationID string) *ConversationHub {
	if hub, exists := h.hubs[conversationID]; exists {
		return hub
	}

	hub := &ConversationHub{
		conversationID: conversationID,
		connections:    make(map[string]*WSConnection),
		broadcast:      make(chan interface{}, 256),
		subscribe:      make(chan *WSConnection, 64),
		unsubscribe:    make(chan *WSConnection, 64),
		repo:           h.repo,
	}

	go hub.run()
	h.hubs[conversationID] = hub
	return hub
}

// ============= Hub event loop =============

func (hub *ConversationHub) run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case conn := <-hub.subscribe:
			hub.connections[conn.ID] = conn
			log.Debug().Str("user_id", conn.ID).Str("conversation", hub.conversationID).Msg("User subscribed")

			hub.broadcastSystemMessage("user_joined", map[string]string{
				"user_id":   conn.UserID,
				"user_name": conn.UserName,
			})

		case conn := <-hub.unsubscribe:
			if _, exists := hub.connections[conn.ID]; exists {
				delete(hub.connections, conn.ID)
				close(conn.send)
				log.Debug().Str("user_id", conn.ID).Str("conversation", hub.conversationID).Msg("User unsubscribed")

				hub.broadcastSystemMessage("user_left", map[string]string{
					"user_id":   conn.UserID,
					"user_name": conn.UserName,
				})

				if len(hub.connections) == 0 {
					// Cleanup expired typing indicators
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					_ = hub.repo.DeleteExpiredTypingIndicators(ctx)
					cancel()
				}
			}

		case message := <-hub.broadcast:
			for _, conn := range hub.connections {
				select {
				case conn.send <- message:
				default:
					log.Warn().Str("user_id", conn.ID).Msg("Connection send buffer full, message dropped")
				}
			}

		case <-ticker.C:
			if len(hub.connections) == 0 {
				log.Debug().Str("conversation", hub.conversationID).Msg("Hub idle, will be cleaned up")
			}
		}
	}
}

func (hub *ConversationHub) broadcastSystemMessage(messageType string, payload map[string]string) {
	msg := WSMessage{
		Type:    messageType,
		Payload: payload,
	}

	select {
	case hub.broadcast <- msg:
	default:
		log.Warn().Str("conversation", hub.conversationID).Msg("Hub broadcast channel full")
	}
}

// ============= Connection read/write pumps =============

func (c *WSConnection) readPump(hub *ConversationHub) {
	defer func() {
		hub.unsubscribe <- c
		c.conn.Close(websocket.StatusNormalClosure, "closing")
	}()

	c.conn.SetReadLimit(64000) // 64KB max message
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		_, data, err := c.conn.Read(ctx)
		cancel()

		if err != nil {
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
				return
			}
			log.Error().Err(err).Str("user_id", c.UserID).Msg("WebSocket read error")
			return
		}

		var wsMsg WSMessage
		if err := json.Unmarshal(data, &wsMsg); err != nil {
			log.Warn().Err(err).Str("user_id", c.UserID).Msg("Failed to unmarshal message")
			continue
		}

		switch wsMsg.Type {
		case "message":
			c.handleMessage(hub, wsMsg.Payload)
		case "typing":
			c.handleTyping(hub, wsMsg.Payload)
		case "read":
			c.handleRead(hub, wsMsg.Payload)
		case "ping":
			hub.broadcast <- WSMessage{Type: "pong"}
		default:
			log.Warn().Str("type", wsMsg.Type).Msg("Unknown message type")
		}
	}
}

func (c *WSConnection) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.Close(websocket.StatusNormalClosure, "closing")
				return
			}

			data, err := json.Marshal(message)
			if err != nil {
				log.Error().Err(err).Msg("Failed to marshal message")
				return
			}

			if err := c.conn.Write(context.Background(), websocket.MessageText, data); err != nil {
				log.Error().Err(err).Str("user_id", c.UserID).Msg("Failed to write WebSocket message")
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.Write(context.Background(), websocket.MessageText, []byte(`{"type":"ping"}`)); err != nil {
				log.Error().Err(err).Str("user_id", c.UserID).Msg("Ping failed")
				return
			}
		}
	}
}

// ============= Message handlers =============

func (c *WSConnection) handleMessage(hub *ConversationHub, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to marshal message payload")
		return
	}

	var msgPayload MessagePayload
	if err := json.Unmarshal(data, &msgPayload); err != nil {
		log.Warn().Err(err).Msg("Invalid message payload")
		return
	}

	if msgPayload.Content == "" && msgPayload.ImageURL == "" {
		log.Warn().Msg("Empty message content and image")
		return
	}

	msgType := msgPayload.Type
	if msgType == "" {
		msgType = "text"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Store message in database
	msg := &model.Message{
		ConversationID: c.ConversationID,
		SenderID:       c.UserID,
		SenderName:     c.UserName,
		Content:        msgPayload.Content,
		MessageType:    msgType,
		ImageURL:       msgPayload.ImageURL,
		CreatedAt:      time.Now(),
	}

	if err := hub.repo.CreateMessage(ctx, msg); err != nil {
		log.Error().Err(err).Msg("Failed to store message")
		return
	}

	// Broadcast to hub
	broadcastMsg := map[string]interface{}{
		"id":              msg.ID,
		"sender_id":       msg.SenderID,
		"sender_name":     msg.SenderName,
		"content":         msg.Content,
		"message_type":    msg.MessageType,
		"image_url":       msg.ImageURL,
		"created_at":      msg.CreatedAt.Unix(),
	}

	hub.broadcast <- WSMessage{
		Type:    "message",
		Payload: broadcastMsg,
	}

	// Clear typing indicator
	_ = hub.repo.DeleteTypingIndicator(ctx, c.ConversationID, c.UserID)
	hub.broadcast <- WSMessage{
		Type: "typing",
		Payload: map[string]interface{}{
			"user_id":    c.UserID,
			"is_typing": false,
		},
	}
}

func (c *WSConnection) handleTyping(hub *ConversationHub, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to marshal typing payload")
		return
	}

	var typingPayload TypingPayload
	if err := json.Unmarshal(data, &typingPayload); err != nil {
		log.Warn().Err(err).Msg("Invalid typing payload")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if typingPayload.IsTyping {
		indicator := &model.TypingIndicator{
			ConversationID: c.ConversationID,
			UserID:         c.UserID,
			TypingAt:       time.Now(),
			ExpiresAt:      time.Now().Add(3 * time.Second),
		}
		_ = hub.repo.CreateTypingIndicator(ctx, indicator)
	} else {
		_ = hub.repo.DeleteTypingIndicator(ctx, c.ConversationID, c.UserID)
	}

	// Broadcast typing state
	hub.broadcast <- WSMessage{
		Type: "typing",
		Payload: map[string]interface{}{
			"user_id":    c.UserID,
			"is_typing": typingPayload.IsTyping,
		},
	}
}

func (c *WSConnection) handleRead(hub *ConversationHub, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to marshal read payload")
		return
	}

	var readPayload ReadPayload
	if err := json.Unmarshal(data, &readPayload); err != nil {
		log.Warn().Err(err).Msg("Invalid read payload")
		return
	}

	if readPayload.MessageID == "" {
		log.Warn().Msg("Missing message_id in read receipt")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Store read receipt
	receipt := &model.ReadReceipt{
		MessageID: readPayload.MessageID,
		ReaderID:  c.UserID,
		ReadAt:    time.Now(),
	}

	if err := hub.repo.CreateReadReceipt(ctx, receipt); err != nil {
		log.Warn().Err(err).Msg("Failed to create read receipt")
		return
	}

	// Update participant's last read message
	_ = hub.repo.UpdateLastReadMessage(ctx, c.ConversationID, c.UserID, readPayload.MessageID)

	// Broadcast read receipt
	hub.broadcast <- WSMessage{
		Type: "read",
		Payload: map[string]interface{}{
			"message_id": readPayload.MessageID,
			"reader_id":  c.UserID,
			"read_at":    receipt.ReadAt.Unix(),
		},
	}
}
