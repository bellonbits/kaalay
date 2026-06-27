# Suqafuran Express API Endpoints

**Base URL:** `https://app.suqafuran.com`  
**API Docs:** `https://app.suqafuran.com/docs`  
**Authentication:** JWT Bearer Token

---

## 🚗 Driver Service Endpoints (Port 8006)

### Profile Management
```
GET    /v1/drivers/profile
       Get driver profile details
       Headers: Authorization: Bearer {token}
       Response: DriverProfile

PATCH  /v1/drivers/profile
       Update driver profile
       Body: { vehicle_type, vehicle_model, location_lat, location_lng }
```

### Status Management
```
PATCH  /v1/drivers/status
       Update driver online/offline/busy status
       Body: { status: "online" | "offline" | "busy" }
```

### Job Offers
```
GET    /v1/drivers/offers
       Get active job offers (30-second expiry)
       Response: DeliveryOffer[]
       
       Fields:
       - id: offer ID
       - order_id: order reference
       - customer_name, customer_phone: recipient info
       - delivery_fee: KES amount
       - estimated_distance: km
       - estimated_duration: minutes
       - pickup_address, dropoff_address: locations
       - expires_at: offer expiry time

POST   /v1/drivers/offers/{offer_id}/accept
       Accept a delivery offer
       Response: ActiveDelivery

POST   /v1/drivers/offers/{offer_id}/reject
       Reject a delivery offer
```

### Active Deliveries
```
GET    /v1/drivers/deliveries/active
       Get all active deliveries
       Response: ActiveDelivery[]
       
       Fields:
       - id: delivery ID
       - order_id: order reference
       - customer_name, customer_phone: recipient
       - status: pending|accepted|picked_up|in_transit|delivered
       - pickup_address, dropoff_address: locations
       - delivery_fee: KES amount
       - eta_minutes: estimated time

GET    /v1/drivers/deliveries/{delivery_id}
       Get specific delivery details

PATCH  /v1/drivers/deliveries/{delivery_id}/status
       Update delivery status
       Body: { status: "picked_up" | "in_transit" | "delivered" }

POST   /v1/drivers/deliveries/{delivery_id}/proof
       Submit proof of delivery
       Body: { image_url: string, notes?: string }
```

### Location Tracking
```
POST   /v1/drivers/location
       Update driver GPS location
       Body: { lat: number, lng: number, heading?: number }
       
       This broadcasts to all tracking customers via WebSocket
```

### Earnings & Wallet
```
GET    /v1/drivers/earnings
       Get earnings history (paginated)
       Query: limit=20&offset=0
       Response: DeliveryEarnings[]
       
       Fields:
       - id: earning ID
       - order_id: order reference
       - gross_amount: total amount
       - platform_fee: platform cut (20%)
       - net_amount: driver earnings (80%)
       - paid_at: payment timestamp

GET    /v1/drivers/earnings/today
       Get today's earnings summary
       Response: { total: number, count: number, average: number }

GET    /v1/wallets/{driver_id}
       Get driver wallet balance
       Response: DriverWallet
       
       Fields:
       - available_balance: ready to withdraw
       - pending_balance: in active deliveries
       - lifetime_earnings: total all-time
       - currency: "KES"

POST   /v1/wallets/withdraw
       Request withdrawal
       Body: { 
         amount: number, 
         method: "mpesa"|"evc"|"zaad"|"sahal", 
         phone: string 
       }

GET    /v1/wallets/{driver_id}/withdrawals
       Get withdrawal history
       Response: DriverWithdrawal[]
```

---

## 🏪 Merchant Service Endpoints (Port 8003)

### Profile
```
GET    /v1/merchants/profile
       Get merchant profile
       Response: Merchant
       
       Fields:
       - id, store_name, slug
       - logo_url, description
       - location_lat, location_lng
       - is_verified, is_active
       - rating

PUT    /v1/merchants/profile
       Update merchant profile
       Body: { store_name, description, address, phone, location_lat, location_lng }
```

### Orders
```
GET    /v1/merchants/orders
       Get orders (filterable by status)
       Query: status=pending|accepted|preparing|ready&limit=50&offset=0
       Response: OrderInbox[]
       
       Fields:
       - id, order_id
       - customer_name, customer_phone
       - type: marketplace|grocery|restaurant
       - items: OrderItem[]
       - total_amount: KES
       - status: order state
       - pickup_address, dropoff_address

GET    /v1/merchants/orders/{order_id}
       Get specific order details

POST   /v1/merchants/orders/{order_id}/accept
       Accept order
       Response: Order

POST   /v1/merchants/orders/{order_id}/reject
       Reject order
       Body: { reason?: string }

PATCH  /v1/merchants/orders/{order_id}/status
       Update order status
       Body: { status: "accepted"|"preparing"|"ready"|"completed"|"cancelled" }
```

### Deliveries
```
GET    /v1/merchants/deliveries
       Get active deliveries for merchant's orders
       Query: limit=20&offset=0
       Response: MerchantDelivery[]
       
       Fields:
       - id, order_id
       - driver_id, driver_name, driver_phone
       - status: pending|picked_up|in_transit|delivered
       - pickup_lat, pickup_lng
       - dropoff_lat, dropoff_lng
       - current_lat, current_lng (driver location)
       - eta_minutes

GET    /v1/merchants/deliveries/{delivery_id}
       Get specific delivery tracking
```

### Analytics
```
GET    /v1/merchants/analytics
       Get merchant performance metrics
       Query: period=today|week|month
       Response: MerchantAnalytics
       
       Fields:
       - total_orders, total_revenue
       - average_rating
       - orders_today, completed_orders, pending_orders
       - cancelled_orders
       - top_products[]
```

---

## 📍 Tracking Service (WebSocket - Port 8007)

### WebSocket Connections
```
WS     wss://app.suqafuran.com/v1/tracking/ws/driver
       Driver broadcasts location to all tracking customers
       
       Send: { type: "location", payload: { lat, lng, heading } }
       Receive: { type: "driver_location", payload: { lat, lng, heading, heading, ts } }

WS     wss://app.suqafuran.com/v1/tracking/ws/order/{order_id}
       Customer tracks delivery in real-time
       
       Receive:
       - { type: "driver_location", payload: { lat, lng } }
       - { type: "order_status", payload: { status, eta_minutes } }
       - { type: "notification", payload: { title, body } }
```

---

## 💬 Messaging Service (WebSocket - Port 8008)

### WebSocket Chat
```
WS     wss://app.suqafuran.com/v1/messages/ws/{conversation_id}
       Real-time messaging between driver, customer, merchant
       
       Send:
       - { type: "message", payload: { content, type: "text"|"image", image_url } }
       - { type: "typing", payload: { is_typing: true|false } }
       - { type: "read", payload: { message_id } }
       
       Receive:
       - { type: "message", payload: { id, sender_id, content, created_at } }
       - { type: "typing", payload: { user_id, is_typing } }
       - { type: "read", payload: { message_id, reader_id, read_at } }
```

### REST Endpoints
```
GET    /v1/messages/conversations
       Get user's conversations
       Response: Conversation[]

POST   /v1/messages/conversations
       Create new conversation
       Body: { type, participant_ids, order_id? }

GET    /v1/messages/conversations/{id}/messages
       Get conversation messages (paginated)
       Query: limit=50&offset=0

POST   /v1/messages/conversations/{id}/messages
       Send message
       Body: { content, type: "text"|"image", image_url? }

POST   /v1/messages/messages/{id}/read
       Mark message as read
```

---

## 💳 Payment Service (Port 8010)

### Payments
```
POST   /v1/payments/initiate
       Start M-Pesa STK push
       Body: { 
         order_id, customer_id, amount, 
         payment_method: "mpesa", 
         mpesa_phone 
       }
       Response: { CheckoutRequestID, status }

GET    /v1/payments/{payment_id}
       Get payment details
       Response: Payment

GET    /v1/payments/{payment_id}/status
       Get payment status

POST   /v1/payments/{payment_id}/refund
       Refund payment
```

### Webhooks
```
POST   /v1/payments/mpesa/callback (PUBLIC - no auth required)
       M-Pesa callback from Safaricom
       Body: Safaricom stkCallback response
       
       This updates payment status when customer enters PIN
```

### Escrow
```
POST   /v1/payments/escrow/{id}/release
       Release payment to driver after delivery
       Auto-calculates 80/20 split
```

### Withdrawals
```
POST   /v1/wallets/withdraw
       Request withdrawal (see Driver Service above)

GET    /v1/wallets/{driver_id}/withdrawals
       Get withdrawal history
```

---

## 🔔 Notification Service (Port 8009)

### Notifications
```
GET    /v1/notifications
       Get user notifications (paginated)
       Response: Notification[]

POST   /v1/notifications
       Create notification (backend only)

PUT    /v1/notifications/{id}/read
       Mark notification as read

DELETE /v1/notifications/{id}
       Delete notification
```

### Preferences
```
GET    /v1/notifications/preferences
       Get notification preferences
       Response: NotificationPreference
       
       Fields:
       - push_enabled, sms_enabled, email_enabled
       - language: "en"|"so"

PUT    /v1/notifications/preferences
       Update preferences
       Body: { push_enabled, sms_enabled, email_enabled, language }
```

---

## 🔐 Authentication & Health

### Health Checks
```
GET    /health
       Service health status
       Response: { status: "healthy" }

GET    /ready
       Readiness probe (dependencies check)
       Response: { ready: true, details: { database: "ok", redis: "ok" } }
```

### Auth (Gateway - Port 8000)
```
POST   /api/v1/auth/send-otp
       Request OTP for phone login
       Body: { phone, role: "driver"|"customer"|"merchant" }

POST   /api/v1/auth/verify-otp
       Verify OTP and get JWT token
       Body: { phone, otp, role }
       Response: { token: "jwt...", user: { id, phone, role, name } }

POST   /api/v1/auth/logout
       Revoke token
```

---

## 📊 Request/Response Examples

### Accept a Delivery Offer
```bash
curl -X POST https://app.suqafuran.com/v1/drivers/offers/offer-123/accept \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..." \
  -H "Content-Type: application/json"

# Response 200
{
  "id": "delivery-456",
  "order_id": "order-789",
  "customer_name": "John Doe",
  "status": "accepted",
  "delivery_fee": 150,
  "pickup_address": "Westlands, Nairobi",
  "dropoff_address": "Karen, Nairobi",
  "eta_minutes": 25
}
```

### Update Delivery Status
```bash
curl -X PATCH https://app.suqafuran.com/v1/drivers/deliveries/delivery-456/status \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"status": "in_transit"}'
```

### Get Today's Earnings
```bash
curl -X GET https://app.suqafuran.com/v1/drivers/earnings/today \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..."

# Response 200
{
  "total": 2500,
  "count": 5,
  "average": 500,
  "currency": "KES"
}
```

### WebSocket: Send Location
```javascript
const ws = new WebSocket('wss://app.suqafuran.com/v1/tracking/ws/driver?token=eyJ0eXAi...');

ws.send(JSON.stringify({
  type: 'location',
  payload: {
    lat: 0.3136,
    lng: 36.8092,
    heading: 45
  }
}));
```

---

## 🎯 Frontend Integration

All endpoints are pre-configured in:
- `lib/services/driver.ts` — Driver API methods
- `lib/services/merchant.ts` — Merchant API methods
- `lib/services/websocket.ts` — WebSocket utilities

**Frontend already has:**
✅ Full type safety (TypeScript interfaces)
✅ Error handling
✅ JWT token management
✅ WebSocket auto-reconnect
✅ Request/response validation

---

**Status:** ✅ All endpoints ready for production  
**Base URL:** `https://app.suqafuran.com`  
**Last Updated:** 2026-06-27
