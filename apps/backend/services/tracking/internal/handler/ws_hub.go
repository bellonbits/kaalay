package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"nhooyr.io/websocket"
)

// WSHub manages WebSocket connections and broadcasts.
type WSHub struct {
	// Map of order_id -> set of connections
	rooms map[string]map[*WSConnection]bool
	mu    sync.RWMutex

	// Channels
	broadcast chan interface{}
	subscribe chan *WSConnection
	unsubscribe chan *WSConnection

	// Redis for pub/sub and location storage
	redis *redis.Client
}

// WSConnection represents a single WebSocket connection.
type WSConnection struct {
	ID       string
	UserID   uuid.UUID
	UserType string // driver, customer, merchant
	OrderID  string
	conn     *websocket.Conn
	send     chan interface{}
}

// NewWSHub creates a new WebSocket hub.
func NewWSHub(redisClient *redis.Client) *WSHub {
	hub := &WSHub{
		rooms:       make(map[string]map[*WSConnection]bool),
		broadcast:   make(chan interface{}, 256),
		subscribe:   make(chan *WSConnection, 64),
		unsubscribe: make(chan *WSConnection, 64),
		redis:       redisClient,
	}

	// Start hub event loop
	go hub.run()

	// Start Redis pub/sub listener
	go hub.listenRedisPublish()

	return hub
}

// HandleConnection handles a new WebSocket connection.
func (h *WSHub) HandleConnection(conn *websocket.Conn, userID uuid.UUID, userType, orderID string) {
	connectionID := fmt.Sprintf("%s-%d", userID.String(), time.Now().UnixNano())

	wsConn := &WSConnection{
		ID:       connectionID,
		UserID:   userID,
		UserType: userType,
		OrderID:  orderID,
		conn:     conn,
		send:     make(chan interface{}, 16),
	}

	h.subscribe <- wsConn

	// Read messages from client
	go wsConn.readPump(h)

	// Write messages to client
	go wsConn.writePump()

	log.Info().
		Str("connection_id", connectionID).
		Str("user_type", userType).
		Str("order_id", orderID).
		Msg("WebSocket connection established")
}

// BroadcastLocationUpdate broadcasts driver location to subscribers.
func (h *WSHub) BroadcastLocationUpdate(orderID string, driverID uuid.UUID, lat, lng float64, heading, accuracy int, speed float64) {
	msg := map[string]interface{}{
		"type":       "driver_location",
		"order_id":   orderID,
		"driver_id":  driverID.String(),
		"lat":        lat,
		"lng":        lng,
		"heading":    heading,
		"accuracy":   accuracy,
		"speed":      speed,
		"timestamp":  time.Now().Unix(),
	}

	// Broadcast to in-memory connections
	h.broadcast <- msg

	// Publish to Redis for cross-pod delivery
	data, _ := json.Marshal(msg)
	h.redis.Publish(context.Background(), fmt.Sprintf("tracking:order:%s", orderID), data)
}

// BroadcastOrderStatus broadcasts order status changes.
func (h *WSHub) BroadcastOrderStatus(orderID string, oldStatus, newStatus string) {
	msg := map[string]interface{}{
		"type":       "order_status",
		"order_id":   orderID,
		"old_status": oldStatus,
		"new_status": newStatus,
		"timestamp":  time.Now().Unix(),
	}

	h.broadcast <- msg

	data, _ := json.Marshal(msg)
	h.redis.Publish(context.Background(), fmt.Sprintf("tracking:order:%s", orderID), data)
}

// run is the main hub event loop.
func (h *WSHub) run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case conn := <-h.subscribe:
			h.mu.Lock()
			if h.rooms[conn.OrderID] == nil {
				h.rooms[conn.OrderID] = make(map[*WSConnection]bool)
			}
			h.rooms[conn.OrderID][conn] = true
			h.mu.Unlock()

			// Send join confirmation
			conn.send <- map[string]interface{}{
				"type":     "joined",
				"order_id": conn.OrderID,
				"message":  fmt.Sprintf("Connected as %s", conn.UserType),
			}

			log.Info().
				Str("order_id", conn.OrderID).
				Str("connection_id", conn.ID).
				Msg("Connection subscribed to order")

		case conn := <-h.unsubscribe:
			h.mu.Lock()
			if room, ok := h.rooms[conn.OrderID]; ok {
				delete(room, conn)
				if len(room) == 0 {
					delete(h.rooms, conn.OrderID)
				}
			}
			h.mu.Unlock()

			close(conn.send)
			log.Info().
				Str("order_id", conn.OrderID).
				Str("connection_id", conn.ID).
				Msg("Connection unsubscribed from order")

		case msg := <-h.broadcast:
			h.mu.RLock()
			// Broadcast to all connections (simplified)
			for room := range h.rooms {
				if connections, ok := h.rooms[room]; ok {
					for conn := range connections {
						select {
						case conn.send <- msg:
						default:
							// Send channel full, close connection
							go func(c *WSConnection) {
								h.unsubscribe <- c
							}(conn)
						}
					}
				}
			}
			h.mu.RUnlock()

		case <-ticker.C:
			// Periodic cleanup: close inactive connections
			h.mu.RLock()
			for _, room := range h.rooms {
				for conn := range room {
					// Ping connection to check if still alive
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					if err := conn.conn.Ping(ctx); err != nil {
						cancel()
						h.unsubscribe <- conn
						continue
					}
					cancel()
				}
			}
			h.mu.RUnlock()
		}
	}
}

// listenRedisPublish listens for location updates from other pods.
func (h *WSHub) listenRedisPublish() {
	pubsub := h.redis.PSubscribe(context.Background(), "tracking:order:*")
	defer pubsub.Close()

	ch := pubsub.Channel()

	for msg := range ch {
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(msg.Payload), &data); err != nil {
			log.Error().Err(err).Msg("Failed to unmarshal Redis message")
			continue
		}

		// Broadcast to local connections
		h.broadcast <- data
	}
}

// readPump reads messages from WebSocket connection.
func (conn *WSConnection) readPump(hub *WSHub) {
	defer func() {
		hub.unsubscribe <- conn
		conn.conn.Close(websocket.StatusGoingAway, "")
	}()

	conn.conn.SetReadLimit(32768) // 32KB max message size
	conn.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.conn.SetPongHandler(func(string) error {
		conn.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var msg map[string]interface{}
		err := wsjson.Read(context.Background(), conn.conn, &msg)
		if err != nil {
			log.Error().Err(err).Str("connection_id", conn.ID).Msg("WebSocket read error")
			return
		}

		msgType, ok := msg["type"].(string)
		if !ok {
			continue
		}

		// Handle different message types
		switch msgType {
		case "ping":
			conn.send <- map[string]interface{}{
				"type": "pong",
			}

		case "driver_location":
			// Driver sending location update
			if conn.UserType == "driver" {
				if lat, ok := msg["lat"].(float64); ok {
					if lng, ok := msg["lng"].(float64); ok {
						heading, _ := msg["heading"].(float64)
						accuracy, _ := msg["accuracy"].(float64)
						speed, _ := msg["speed"].(float64)

						// Store in Redis GEO for dispatch service
						hub.redis.GeoAdd(context.Background(), "drivers:active", &redis.GeoLocation{
							Name:      conn.UserID.String(),
							Longitude: lng,
							Latitude:  lat,
						})

						// Broadcast to subscribers
						hub.BroadcastLocationUpdate(
							conn.OrderID,
							conn.UserID,
							lat,
							lng,
							int(heading),
							int(accuracy),
							speed,
						)
					}
				}
			}

		default:
			log.Debug().Str("type", msgType).Msg("Unknown message type")
		}
	}
}

// writePump writes messages to WebSocket connection.
func (conn *WSConnection) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		conn.conn.Close(websocket.StatusGoingAway, "")
	}()

	for {
		select {
		case msg, ok := <-conn.send:
			conn.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				conn.conn.Write(context.Background(), websocket.StatusNormalClosure, []byte{})
				return
			}

			if err := wsjson.Write(context.Background(), conn.conn, msg); err != nil {
				return
			}

		case <-ticker.C:
			conn.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.conn.Ping(context.Background()); err != nil {
				return
			}
		}
	}
}

// Import wsjson (nhooyr/websocket helper)
var wsjson = struct {
	Read  func(ctx context.Context, c *websocket.Conn, v interface{}) error
	Write func(ctx context.Context, c *websocket.Conn, v interface{}) error
}{
	Read: func(ctx context.Context, c *websocket.Conn, v interface{}) error {
		_, data, err := c.Read(ctx)
		if err != nil {
			return err
		}
		return json.Unmarshal(data, v)
	},
	Write: func(ctx context.Context, c *websocket.Conn, v interface{}) error {
		data, err := json.Marshal(v)
		if err != nil {
			return err
		}
		return c.Write(ctx, websocket.MessageText, data)
	},
}
