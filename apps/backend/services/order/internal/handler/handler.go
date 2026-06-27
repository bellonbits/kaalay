package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog/log"
	"github.com/suqafuran/express/services/order/internal/model"
	"github.com/suqafuran/express/services/order/internal/repository"
	"github.com/suqafuran/express/shared/pkg"
)

// Handler contains all order endpoint handlers.
type Handler struct {
	db   *pgxpool.Pool
	repo repository.OrderRepository
	nats *nats.Conn
}

// NewHandler creates a new handler.
func NewHandler(db *pgxpool.Pool, repo repository.OrderRepository, nc *nats.Conn) *Handler {
	return &Handler{
		db:   db,
		repo: repo,
		nats: nc,
	}
}

// HealthHandler returns service health.
func (h *Handler) HealthHandler(c *context.Context) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(pkg.HealthResponse{
			Status:  "healthy",
			Message: "Order service is running",
		})
	})
}

// ReadyHandler checks if service is ready.
func (h *Handler) ReadyHandler(c *context.Context) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check DB connectivity
		if err := h.db.Ping(r.Context()); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(pkg.ReadyResponse{
				Ready: false,
				Details: map[string]string{
					"database": "unreachable",
				},
			})
			return
		}

		// Check NATS connectivity
		if h.nats == nil || h.nats.Status() != nats.CONNECTED {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(pkg.ReadyResponse{
				Ready: false,
				Details: map[string]string{
					"nats": "unreachable",
				},
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(pkg.ReadyResponse{
			Ready: true,
			Details: map[string]string{
				"database": "ok",
				"nats":     "ok",
			},
		})
	})
}

// Event Publishing

// OrderCreatedEvent is published when an order is created.
type OrderCreatedEvent struct {
	Event        string     `json:"event"`
	OrderID      uuid.UUID  `json:"order_id"`
	CustomerID   uuid.UUID  `json:"customer_id"`
	MerchantID   *uuid.UUID `json:"merchant_id,omitempty"`
	Type         string     `json:"type"`
	PickupLat    *float64   `json:"pickup_lat,omitempty"`
	PickupLng    *float64   `json:"pickup_lng,omitempty"`
	PickupAddr   string     `json:"pickup_address"`
	DropoffLat   *float64   `json:"dropoff_lat,omitempty"`
	DropoffLng   *float64   `json:"dropoff_lng,omitempty"`
	DropoffAddr  string     `json:"dropoff_address"`
	ScheduledAt  *int64     `json:"scheduled_at,omitempty"`
	TotalAmount  *float64   `json:"total_amount,omitempty"`
	DeliveryFee  *float64   `json:"delivery_fee,omitempty"`
	Currency     string     `json:"currency"`
	Timestamp    int64      `json:"ts"`
}

// OrderStatusChangedEvent is published when order status changes.
type OrderStatusChangedEvent struct {
	Event        string    `json:"event"`
	OrderID      uuid.UUID `json:"order_id"`
	OldStatus    string    `json:"old_status"`
	NewStatus    string    `json:"new_status"`
	Timestamp    int64     `json:"ts"`
}

func (h *Handler) publishOrderCreatedEvent(ctx context.Context, order *model.Order) {
	if h.nats == nil || h.nats.Status() != nats.CONNECTED {
		log.Warn().Msg("NATS not connected, skipping event publish")
		return
	}

	event := OrderCreatedEvent{
		Event:       "order.created",
		OrderID:     order.ID,
		CustomerID:  order.CustomerID,
		MerchantID:  order.MerchantID,
		Type:        string(order.Type),
		PickupLat:   order.PickupLat,
		PickupLng:   order.PickupLng,
		PickupAddr:  order.PickupAddress,
		DropoffLat:  order.DropoffLat,
		DropoffLng:  order.DropoffLng,
		DropoffAddr: order.DropoffAddress,
		TotalAmount: order.TotalAmount,
		DeliveryFee: order.DeliveryFee,
		Currency:    order.Currency,
		Timestamp:   time.Now().Unix(),
	}

	if order.ScheduledAt != nil {
		ts := order.ScheduledAt.Unix()
		event.ScheduledAt = &ts
	}

	data, err := json.Marshal(event)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal order.created event")
		return
	}

	if err := h.nats.Publish("order.created", data); err != nil {
		log.Error().Err(err).Msg("Failed to publish order.created event")
		return
	}

	log.Info().
		Str("order_id", order.ID.String()).
		Str("event", "order.created").
		Msg("Event published")
}

func (h *Handler) publishOrderStatusChangedEvent(ctx context.Context, orderID uuid.UUID, oldStatus, newStatus model.OrderStatus) {
	if h.nats == nil || h.nats.Status() != nats.CONNECTED {
		log.Warn().Msg("NATS not connected, skipping event publish")
		return
	}

	event := OrderStatusChangedEvent{
		Event:      "order.status_changed",
		OrderID:    orderID,
		OldStatus:  string(oldStatus),
		NewStatus:  string(newStatus),
		Timestamp:  time.Now().Unix(),
	}

	data, err := json.Marshal(event)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal order.status_changed event")
		return
	}

	if err := h.nats.Publish("order.status_changed", data); err != nil {
		log.Error().Err(err).Msg("Failed to publish order.status_changed event")
		return
	}

	log.Info().
		Str("order_id", orderID.String()).
		Str("old_status", string(oldStatus)).
		Str("new_status", string(newStatus)).
		Str("event", "order.status_changed").
		Msg("Event published")
}
