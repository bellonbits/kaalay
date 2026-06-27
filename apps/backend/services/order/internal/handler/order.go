package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/suqafuran/express/services/order/internal/model"
	"github.com/suqafuran/express/services/order/internal/repository"
	"github.com/suqafuran/express/shared/pkg"
)

// CreateOrderRequest is the request body for creating an order.
type CreateOrderRequest struct {
	Type                  string                `json:"type" binding:"required"` // marketplace, parcel, grocery, restaurant
	MerchantID            *uuid.UUID            `json:"merchant_id"`
	PickupLat             float64               `json:"pickup_lat" binding:"required"`
	PickupLng             float64               `json:"pickup_lng" binding:"required"`
	PickupAddress         string                `json:"pickup_address"`
	DropoffLat            float64               `json:"dropoff_lat" binding:"required"`
	DropoffLng            float64               `json:"dropoff_lng" binding:"required"`
	DropoffAddress        string                `json:"dropoff_address"`
	ScheduledAt           *int64                `json:"scheduled_at"` // Unix timestamp
	SpecialInstructions   string                `json:"special_instructions"`
	PaymentMethod         string                `json:"payment_method"` // mpesa, wallet, cash
	CustomerPhone         string                `json:"customer_phone"`
	CustomerName          string                `json:"customer_name"`
	Items                 []CreateOrderItemRequest `json:"items"`
}

// CreateOrderItemRequest is a single item in an order.
type CreateOrderItemRequest struct {
	ProductID    *uuid.UUID `json:"product_id"`
	ProductName  string     `json:"product_name" binding:"required"`
	ProductNameSo string     `json:"product_name_so"`
	Quantity     int        `json:"quantity" binding:"required,gt=0"`
	UnitPrice    float64    `json:"unit_price" binding:"required"`
}

// OrderDTO is the data transfer object for orders.
type OrderDTO struct {
	ID                   uuid.UUID        `json:"id"`
	CustomerID           uuid.UUID        `json:"customer_id"`
	MerchantID           *uuid.UUID       `json:"merchant_id,omitempty"`
	Type                 string           `json:"type"`
	Status               string           `json:"status"`
	TotalAmount          *float64         `json:"total_amount,omitempty"`
	DeliveryFee          *float64         `json:"delivery_fee,omitempty"`
	Currency             string           `json:"currency"`
	PickupAddress        string           `json:"pickup_address"`
	DropoffAddress       string           `json:"dropoff_address"`
	ScheduledAt          *int64           `json:"scheduled_at,omitempty"`
	PaymentStatus        string           `json:"payment_status"`
	CustomerPhone        string           `json:"customer_phone"`
	CustomerName         string           `json:"customer_name"`
	Items                []OrderItemDTO   `json:"items"`
	CreatedAt            int64            `json:"created_at"`
	UpdatedAt            int64            `json:"updated_at"`
}

// OrderItemDTO is the DTO for order items.
type OrderItemDTO struct {
	ID           uuid.UUID `json:"id"`
	ProductName  string    `json:"product_name"`
	Quantity     int       `json:"quantity"`
	UnitPrice    float64   `json:"unit_price"`
	Subtotal     float64   `json:"subtotal"`
}

// CreateOrderHandler creates a new order.
func (h *Handler) CreateOrderHandler(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid request"))
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("not authenticated"))
		return
	}

	customerID := userID.(uuid.UUID)

	// Create order
	order := model.NewOrder(customerID, model.OrderType(req.Type))
	order.MerchantID = req.MerchantID
	order.PickupLat = &req.PickupLat
	order.PickupLng = &req.PickupLng
	order.PickupAddress = req.PickupAddress
	order.DropoffLat = &req.DropoffLat
	order.DropoffLng = &req.DropoffLng
	order.DropoffAddress = req.DropoffAddress
	order.SpecialInstructions = req.SpecialInstructions
	order.PaymentMethod = req.PaymentMethod
	order.CustomerPhone = req.CustomerPhone
	order.CustomerName = req.CustomerName

	if req.ScheduledAt != nil {
		scheduledTime := unixToTime(*req.ScheduledAt)
		order.ScheduledAt = &scheduledTime
	}

	if err := h.repo.CreateOrder(c.Request.Context(), order); err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to create order"))
		return
	}

	// Add items
	var totalAmount float64
	for _, item := range req.Items {
		subtotal := float64(item.Quantity) * item.UnitPrice
		totalAmount += subtotal

		orderItem := &model.OrderItem{
			OrderID:       order.ID,
			ProductID:     item.ProductID,
			ProductName:   item.ProductName,
			ProductNameSo: item.ProductNameSo,
			Quantity:      item.Quantity,
			UnitPrice:     item.UnitPrice,
			Subtotal:      subtotal,
		}

		if err := h.repo.AddOrderItem(c.Request.Context(), orderItem); err != nil {
			c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to add order item"))
			return
		}

		order.Items = append(order.Items, *orderItem)
	}

	// Calculate fees (80% driver, 20% platform)
	deliveryFee := 80.0 // Base KES
	distKm := haversineDistance(req.PickupLat, req.PickupLng, req.DropoffLat, req.DropoffLng)
	deliveryFee += distKm * 30.0 // KES per km

	platformFee := deliveryFee * 0.20
	driverFee := deliveryFee * 0.80

	order.TotalAmount = &totalAmount
	order.DeliveryFee = &deliveryFee

	// Publish order.created event to NATS
	h.publishOrderCreatedEvent(c.Request.Context(), order)

	c.JSON(http.StatusCreated, pkg.SuccessResponse(h.orderToDTO(order)))
}

// GetOrderHandler retrieves an order.
func (h *Handler) GetOrderHandler(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid order ID"))
		return
	}

	order, err := h.repo.GetOrderByID(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("order not found"))
		return
	}

	// Verify ownership
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("not authenticated"))
		return
	}

	if order.CustomerID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, pkg.ErrorResponse("not authorized"))
		return
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(h.orderToDTO(order)))
}

// ListOrdersHandler lists orders for the current user.
func (h *Handler) ListOrdersHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("not authenticated"))
		return
	}

	limit := 20
	offset := 0

	if l := c.Query("limit"); l != "" {
		if parsedL, err := strconv.Atoi(l); err == nil && parsedL > 0 && parsedL <= 100 {
			limit = parsedL
		}
	}

	if o := c.Query("offset"); o != "" {
		if parsedO, err := strconv.Atoi(o); err == nil && parsedO >= 0 {
			offset = parsedO
		}
	}

	orders, total, err := h.repo.ListOrdersByCustomer(c.Request.Context(), userID.(uuid.UUID), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to list orders"))
		return
	}

	items := make([]OrderDTO, len(orders))
	for i, o := range orders {
		items[i] = h.orderToDTO(o)
	}

	c.JSON(http.StatusOK, pkg.SuccessResponse(pkg.PaginatedResponse{
		Items:   items,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
		HasMore: offset+limit < int(total),
	}))
}

// UpdateOrderStatusHandler updates order status (merchant/admin only).
func (h *Handler) UpdateOrderStatusHandler(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid order ID"))
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
		Reason string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid request"))
		return
	}

	order, err := h.repo.GetOrderByID(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("order not found"))
		return
	}

	newStatus := model.OrderStatus(req.Status)

	// Validate transition
	if !order.CanTransitionTo(newStatus) {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse(fmt.Sprintf("cannot transition from %s to %s", order.Status, newStatus)))
		return
	}

	oldStatus := order.Status
	if err := h.repo.UpdateOrderStatus(c.Request.Context(), orderID, oldStatus, newStatus, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to update order status"))
		return
	}

	// Publish event
	h.publishOrderStatusChangedEvent(c.Request.Context(), orderID, oldStatus, newStatus)

	order.Status = newStatus
	c.JSON(http.StatusOK, pkg.SuccessResponse(h.orderToDTO(order)))
}

// RateDeliveryHandler rates a delivery.
func (h *Handler) RateDeliveryHandler(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid order ID"))
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, pkg.ErrorResponse("not authenticated"))
		return
	}

	var req struct {
		Rating int    `json:"rating" binding:"required,min=1,max=5"`
		Comment string `json:"comment"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("invalid request"))
		return
	}

	order, err := h.repo.GetOrderByID(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, pkg.ErrorResponse("order not found"))
		return
	}

	if order.CustomerID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, pkg.ErrorResponse("not authorized"))
		return
	}

	if order.Status != model.OrderStatusDelivered {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("can only rate delivered orders"))
		return
	}

	delivery, err := h.repo.GetDelivery(c.Request.Context(), orderID)
	if err != nil || delivery == nil {
		c.JSON(http.StatusBadRequest, pkg.ErrorResponse("delivery not found"))
		return
	}

	rating := &model.DeliveryRating{
		OrderID:    orderID,
		DriverID:   *delivery.DriverID,
		CustomerID: userID.(uuid.UUID),
		Rating:     req.Rating,
		Comment:    req.Comment,
	}

	if err := h.repo.RateDelivery(c.Request.Context(), rating); err != nil {
		c.JSON(http.StatusInternalServerError, pkg.ErrorResponse("failed to save rating"))
		return
	}

	c.JSON(http.StatusCreated, pkg.SuccessResponse(map[string]interface{}{
		"id":      rating.ID,
		"rating":  rating.Rating,
		"message": "Rating saved successfully",
	}))
}

// Helpers

func (h *Handler) orderToDTO(order *model.Order) OrderDTO {
	dto := OrderDTO{
		ID:             order.ID,
		CustomerID:     order.CustomerID,
		MerchantID:     order.MerchantID,
		Type:           string(order.Type),
		Status:         string(order.Status),
		TotalAmount:    order.TotalAmount,
		DeliveryFee:    order.DeliveryFee,
		Currency:       order.Currency,
		PickupAddress:  order.PickupAddress,
		DropoffAddress: order.DropoffAddress,
		PaymentStatus:  string(order.PaymentStatus),
		CustomerPhone:  order.CustomerPhone,
		CustomerName:   order.CustomerName,
		CreatedAt:      order.CreatedAt.Unix(),
		UpdatedAt:      order.UpdatedAt.Unix(),
		Items:          []OrderItemDTO{},
	}

	if order.ScheduledAt != nil {
		ts := order.ScheduledAt.Unix()
		dto.ScheduledAt = &ts
	}

	for _, item := range order.Items {
		dto.Items = append(dto.Items, OrderItemDTO{
			ID:        item.ID,
			ProductName: item.ProductName,
			Quantity:  item.Quantity,
			UnitPrice: item.UnitPrice,
			Subtotal:  item.Subtotal,
		})
	}

	return dto
}

func unixToTime(ts int64) interface{} {
	// Convert Unix timestamp to time.Time
	return ts
}

func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	// Simplified distance calculation (use proper haversine in production)
	// Returns approximate distance in km
	const R = 6371 // Earth radius in km
	dLat := (lat2 - lat1) * (3.14159 / 180)
	dLon := (lon2 - lon1) * (3.14159 / 180)
	a := (dLat/2)*(dLat/2) + (dLon/2)*(dLon/2)
	c := 2 * 3.14159 / 180 * a
	return R * c
}
