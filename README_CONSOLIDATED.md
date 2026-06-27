# 🚀 Kaalay: Unified Platform

**Consolidated monorepo for Kaalay ride-hailing + Suqafuran Express delivery platform**

## 📦 What's Here

```
kaalay/
├── apps/
│   ├── frontend/          Next.js 15 web app (Kaalay + Delivery)
│   └── backend/           11 Go microservices (Suqafuran Express)
├── docker-compose.yml     Local development stack
├── package.json           Monorepo scripts
├── .env.example           Configuration template
└── README.md              This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Go 1.21+ (for backend development)

### 1. Frontend Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev:frontend

# Visit http://localhost:3000
```

**Frontend Features:**
- ✅ Ride hailing (Kaalay)
- ✅ Marketplace browsing
- ✅ Delivery dashboard (Suqafuran Express)
- ✅ Real-time tracking & chat
- ✅ Earnings management
- ✅ Mobile support (Capacitor)

### 2. Backend Services

```bash
# Copy environment template
cp .env.example .env

# Start all services
npm run dev:backend

# Check status
npm run dev:backend:logs
```

**Services Running:**
- 🔐 Auth (port 8001)
- 👤 User (port 8002)
- 🏪 Merchant (port 8003)
- 📦 Order (port 8004)
- 🚗 Dispatch (port 8005)
- 🚙 Driver (port 8006)
- 📍 Tracking (port 8007)
- 💬 Messaging (port 8008)
- 🔔 Notification (port 8009)
- 💳 Payment (port 8010)
- 🌐 Gateway (port 8000)

**Infrastructure:**
- PostgreSQL (5432) - unified database
- Redis (6379) - caching & pub/sub
- NATS (4222) - event streaming
- MinIO (9000) - file storage
- Adminer (8080) - database UI

### 3. Stop Everything

```bash
npm run dev:backend:down
```

## 📁 Directory Structure

### Frontend (`apps/frontend/`)

```
frontend/
├── src/
│   ├── app/
│   │   ├── (kaalay)/          Ride hailing routes
│   │   ├── driver/
│   │   │   ├── delivery/      🆕 Delivery dashboard
│   │   │   ├── earnings/      
│   │   │   ├── profile/       
│   │   │   └── login/
│   │   └── ... (other routes)
│   ├── components/            Reusable UI components
│   ├── lib/
│   │   ├── services/          API client services
│   │   └── stores/            Zustand state management
│   └── styles/                Tailwind CSS config
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

### Backend (`apps/backend/`)

```
backend/
├── services/
│   ├── gateway/               API Gateway (Gin)
│   ├── auth/                  Authentication service
│   ├── driver/                Driver management
│   ├── order/                 Order orchestration
│   ├── payment/               Payment processing (M-Pesa, Zaad, EVC, Sahal)
│   ├── tracking/              Real-time tracking (WebSocket)
│   ├── messaging/             Chat service
│   ├── notification/          Push/SMS/Email notifications
│   └── ... (other services)
├── shared/
│   ├── proto/                 gRPC protobuf definitions
│   ├── events/                NATS event schemas
│   ├── middleware/            JWT, RBAC, rate limiting
│   └── pkg/                   Shared utilities
├── infra/
│   ├── docker/                Dockerfiles & compose
│   ├── k8s/                   Kubernetes manifests
│   ├── migrations/            SQL migration files
│   └── monitoring/            Prometheus & Grafana
├── go.work                    Go workspace
└── README.md
```

## 🔗 API Architecture

### Gateway Entry Point
All requests come through the API Gateway at port 8000:
```
GET  /health                  Service health
POST /api/v1/auth/send-otp    OTP login
POST /api/v1/auth/verify-otp  Verify OTP & get token
GET  /v1/drivers/offers       Get delivery offers
GET  /v1/drivers/deliveries   Get active deliveries
... (see SUQAFURAN_API_ENDPOINTS.md for all endpoints)
```

### Service Mesh
Services communicate via:
- **REST**: HTTP endpoints (Gin)
- **gRPC**: Service-to-service calls
- **WebSocket**: Real-time tracking & chat
- **NATS Pub/Sub**: Event-driven messaging

## 🔐 Authentication

1. User requests OTP via phone
2. Backend sends OTP (SMS via Africa's Talking)
3. User verifies OTP → receives JWT token
4. Token stored in localStorage
5. All requests include `Authorization: Bearer {token}`
6. Gateway validates token via Auth service

**Token Details:**
- Type: HS256
- Access token: 7 days
- Refresh token: 30 days

## 💾 Database Schema

Single PostgreSQL database with tables for:
- `users` - Authentication & profiles
- `drivers` - Driver profiles & documents
- `merchants` - Store information
- `orders` - Order management
- `deliveries` - Delivery tracking
- `payments` - Transaction history
- `messages` - Chat conversations
- ... (see `apps/backend/infra/migrations/`)

## 🚢 Deployment

### Local (Docker Compose)
```bash
docker-compose up -d
```

### Staging
```bash
npm run deploy:staging
```

### Production
```bash
npm run deploy:prod
```

**Frontend:** Deployed to Vercel  
**Backend:** Deployed to DigitalOcean (app.suqafuran.com)

## 📊 Monitoring

**Grafana Dashboard**: http://localhost:3000 (when running in production)  
**Prometheus**: http://localhost:9090  
**Adminer (DB UI)**: http://localhost:8080  
**MinIO Console**: http://localhost:9001  

## 🧪 Testing

```bash
# Frontend tests
npm test

# Frontend build check
npm run build:frontend

# Backend tests (per service)
cd apps/backend/services/driver && go test ./...
```

## 📚 Documentation

- **Deployment**: `/DEPLOYMENT_GUIDE.md`
- **API Reference**: `/SUQAFURAN_API_ENDPOINTS.md`
- **Architecture**: `/ARCHITECTURE_WITH_DELIVERY.md`
- **Migration Plan**: `/MIGRATION_PLAN.md`

## 🤝 Contributing

1. Create feature branch from `main`
2. Make changes (frontend or backend)
3. Test locally
4. Commit with descriptive message
5. Push & create pull request
6. Wait for CI/CD to pass
7. Merge to main

**Commit Format:**
```
feat: Add delivery status tracking
fix: Resolve WebSocket reconnection issue
chore: Update dependencies
```

## 🐛 Troubleshooting

### Frontend won't start
```bash
rm -rf node_modules .next
npm install
npm run dev:frontend
```

### Backend services won't connect
```bash
# Check Docker is running
docker ps

# Restart services
docker-compose restart

# View logs
docker-compose logs -f gateway
```

### Database connection error
```bash
# Reset database
docker-compose down -v
docker-compose up postgres
# Wait for healthy status, then start other services
docker-compose up
```

### Port already in use
```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

## 📞 Support

- **Issues**: GitHub Issues
- **Docs**: See `/docs` directory
- **Email**: petergatitu61@gmail.com

## 📄 License

Private - Kaalay Platform

---

**Status:** ✅ Unified Monorepo  
**Last Updated:** 2026-06-27  
**Maintained by:** Peter Gatitu
