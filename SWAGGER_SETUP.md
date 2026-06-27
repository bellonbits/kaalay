# Swagger UI Setup for Kaalay Express

Swagger UI provides interactive API documentation for all Kaalay microservices.

## Access Swagger UI

After deployment, access the API documentation at:

```
http://app.suqafuran.com/docs/index.html
```

Or locally during development:
```
http://localhost:8000/docs/index.html  # Gateway
http://localhost:8001/docs/index.html  # Auth
http://localhost:8004/docs/index.html  # Order
http://localhost:8008/docs/index.html  # Messaging
http://localhost:8010/docs/index.html  # Payment
```

## Available Endpoints

### System
- `GET /health` - Health check (always returns 200)
- `GET /ready` - Readiness check (checks DB and Redis connectivity)

### Auth Service (Port 8001)
- `POST /v1/auth/send-otp` - Send OTP to phone number
- `POST /v1/auth/verify-otp` - Verify OTP and get JWT token
- `GET /v1/auth/me` - Get current user info (requires auth)

### Order Service (Port 8004)
- `POST /v1/orders` - Create new order
- `GET /v1/orders/{id}` - Get order details
- `PUT /v1/orders/{id}/status` - Update order status

### Payment Service (Port 8010)
- `POST /v1/payments/initiate` - Initiate payment
- `GET /v1/payments/{id}` - Get payment status
- `POST /v1/payments/{id}/refund` - Refund payment

### Messaging Service (Port 8008)
- `GET /v1/messages/conversations` - List conversations
- `POST /v1/messages/conversations` - Create conversation
- `GET /ws/:conversation_id` - WebSocket connection for real-time chat

### Tracking Service (Port 8007)
- `GET /ws/tracking/{order_id}` - WebSocket for live order tracking

## Adding Swagger Annotations

To add Swagger documentation to a new endpoint, add comments above the handler function:

```go
// SendOTP godoc
// @Summary Send OTP to phone
// @Description Send a one-time password to the provided phone number
// @Tags auth
// @Accept json
// @Produce json
// @Param phone body string true "Phone number"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Router /v1/auth/send-otp [post]
func (h *Handler) SendOTP(c *gin.Context) {
    // implementation
}
```

## Dependencies

The Swagger UI uses `swaggo/swag` package:

```bash
go get -u github.com/swaggo/swag/cmd/swag
go get -u github.com/swaggo/gin-swagger
go get -u github.com/swaggo/files
```

## Generate Swagger Docs

To regenerate swagger documentation after changes:

```bash
cd apps/backend/services/gateway
swag init -g cmd/main.go

cd ../auth
swag init -g cmd/main.go

# Repeat for each service
```

## Features

✅ Interactive API testing - Try endpoints directly from UI
✅ Request/Response schemas - See exact data structures
✅ Authentication - Bearer token support for protected endpoints
✅ Real-time documentation - Auto-updated with code comments

## Notes

- WebSocket endpoints (`/ws/*`) are documented but cannot be tested from Swagger UI
- Use curl, Postman, or the frontend app for WebSocket testing
- All endpoints require Bearer token authentication except `/health`, `/ready`, and public auth endpoints
