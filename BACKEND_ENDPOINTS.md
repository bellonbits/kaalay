# Kaalay Express — Backend API Endpoints

## Base URL
`http://165.22.13.173:8000/api/v1` (from frontend)

## Auth Service (Port 8001)

### Public Endpoints
- `POST /v1/auth/send-otp` — Send OTP to phone
  - Body: `{ "phone": "+254712345678" }`
  - Response: `{ "success": true, "message": "OTP sent" }`

- `POST /v1/auth/verify-otp` — Verify OTP and get JWT
  - Body: `{ "phone": "+254712345678", "code": "123456" }`
  - Response: `{ "success": true, "data": { "access_token": "...", "refresh_token": "...", "expires_in": 604800 } }`

### Protected Endpoints (require JWT)
- `GET /v1/auth/me` — Get current user
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "success": true, "data": { "id": "uuid", "phone": "...", "role": "customer" } }`

---

## Order Service (Port 8004)

### Protected Endpoints (all require JWT)

- `POST /v1/orders` — Create new order
  - Body: `{ "type": "parcel", "pickup_lat": -1.2921, "pickup_lng": 36.8219, "pickup_address": "...", "dropoff_lat": ..., "dropoff_lng": ..., "dropoff_address": "..." }`
  - Response: `{ "success": true, "data": { "id": "uuid", "status": "pending" } }`

- `GET /v1/orders` — List user's orders
  - Query: `?limit=50&offset=0`
  - Response: `{ "success": true, "data": [{ "id": "uuid", "status": "pending", ... }] }`

- `GET /v1/orders/{id}` — Get order details
  - Response: `{ "success": true, "data": { "id": "uuid", "status": "pending", ... } }`

- `PATCH /v1/orders/{id}/status` — Update order status
  - Body: `{ "status": "accepted" }`
  - Response: `{ "success": true, "data": { "id": "uuid", "status": "accepted" } }`

- `POST /v1/orders/{id}/rate` — Rate delivery
  - Body: `{ "rating": 5, "comment": "Great service" }`
  - Response: `{ "success": true }`

---

## Payment Service (Port 8010)

### Public Endpoints
- `POST /v1/payments/mpesa/callback` — M-Pesa webhook (no auth)
  - Body: M-Pesa callback payload

### Protected Endpoints (require JWT)

- `POST /v1/payments/initiate` — Initiate payment
  - Body: `{ "amount": 1000, "phone": "+254712345678", "order_id": "uuid" }`
  - Response: `{ "success": true, "data": { "id": "uuid", "status": "pending" } }`

- `GET /v1/payments/{id}` — Get payment details
  - Response: `{ "success": true, "data": { "id": "uuid", "amount": 1000, "status": "completed" } }`

- `GET /v1/payments/{id}/status` — Check payment status
  - Response: `{ "success": true, "data": { "status": "completed" } }`

- `POST /v1/payments/{id}/refund` — Refund payment
  - Body: `{ "reason": "Order cancelled" }`
  - Response: `{ "success": true, "data": { "id": "uuid", "status": "refunded" } }`

- `POST /v1/payments/escrow/{id}/release` — Release escrow funds
  - Response: `{ "success": true }`

### Wallet Endpoints (Protected)

- `GET /v1/wallets/{driver_id}` — Get driver wallet
  - Response: `{ "success": true, "data": { "balance": 50000, "currency": "KES" } }`

- `POST /v1/wallets/withdraw` — Request withdrawal
  - Body: `{ "amount": 10000, "method": "mpesa", "phone": "+254712345678" }`
  - Response: `{ "success": true, "data": { "id": "uuid", "status": "pending" } }`

- `GET /v1/wallets/{driver_id}/withdrawals` — Get withdrawal history
  - Response: `{ "success": true, "data": [{ "id": "uuid", "amount": 10000, "status": "completed" }] }`

---

## Gateway Health Checks

- `GET /health` — Gateway health (public)
- `GET /ready` — Gateway readiness (public)

---

## Frontend API Client Updates Needed

Update `apps/frontend/lib/api.ts`:

```typescript
// Auth
export const sendOTP = (phone: string) => 
  api.post("/auth/send-otp", { phone });

export const verifyOTP = (phone: string, code: string) => 
  api.post("/auth/verify-otp", { phone, code });

export const getMe = () => 
  api.get("/auth/me");

// Orders
export const createOrder = (data) => 
  api.post("/orders", data);

export const listOrders = (limit = 50, offset = 0) => 
  api.get("/orders", { params: { limit, offset } });

export const getOrder = (id: string) => 
  api.get(`/orders/${id}`);

export const updateOrderStatus = (id: string, status: string) => 
  api.patch(`/orders/${id}/status`, { status });

// Payments
export const initiatePayment = (data) => 
  api.post("/payments/initiate", data);

export const getPaymentStatus = (id: string) => 
  api.get(`/payments/${id}/status`);

// Wallets
export const getDriverWallet = (driverId: string) => 
  api.get(`/wallets/${driverId}`);

export const requestWithdrawal = (data) => 
  api.post("/wallets/withdraw", data);
```

---

## Status Enum Values

**Order Status:**
- `pending` → `accepted` → `preparing` → `ready_for_pickup` → `driver_assigned` → `picked_up` → `in_transit` → `delivered`
- Can also be: `cancelled`

**Payment Status:**
- `pending` → `completed` | `refunded` | `failed`

**Withdrawal Status:**
- `pending` → `completed` | `rejected` | `failed`
