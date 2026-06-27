# Architecture: Kaalay + Suqafuran Express Delivery Integration

**Important:** This is a **unified frontend** with **two separate backends**

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│            KAALAY FRONTEND-V2 (Single Next.js App)         │
│                   https://kaalay.app                       │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────┐               │
│  │  Ride Hailing   │    │  Marketplace     │               │
│  │  /driver/ride   │    │  /home           │               │
│  │  Accept rides   │    │  Browse stores   │               │
│  │  Track location │    │  Add to cart     │               │
│  └────────┬────────┘    └────────┬─────────┘               │
│           │                      │                         │
│           │  ┌──────────────────────────┐                 │
│           │  │ NEW: Delivery Features   │                 │
│           │  │ /driver/delivery         │                 │
│           │  │ Accept delivery jobs     │                 │
│           │  │ Track deliveries         │                 │
│           └──┼──────────────────────────┤                 │
│              │  Real-time Updates       │                 │
│              │  Chat Messages           │                 │
│              │  Earnings (rides+        │                 │
│              │   deliveries)            │                 │
│              └──────────────────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
          ↓                           ↓
     (API Calls)              (API Calls)
          ↓                           ↓
    ┌─────────────┐          ┌──────────────────────┐
    │   KAALAY    │          │  SUQAFURAN EXPRESS   │
    │   Backend   │          │     Backend          │
    │ (FastAPI)   │          │  (Go Microservices)  │
    │             │          │                      │
    │ Port: 5000  │          │  Ports: 8000-8010    │
    │             │          │                      │
    │ ├─ Rides    │          │  ├─ Driver Service   │
    │ ├─ Users    │          │  ├─ Merchant API     │
    │ ├─ Places   │          │  ├─ Tracking (WS)    │
    │ ├─ Messages │          │  ├─ Messaging (WS)   │
    │ └─ Auth     │          │  ├─ Payment Service  │
    │             │          │  └─ Notification     │
    └─────────────┘          └──────────────────────┘
         (Existing)            (New - Delivery Only)
```

---

## 📱 **Frontend Routes**

### **Kaalay Routes** (Existing - use Kaalay backend)
```
/                          → Home / Browse marketplace
/rides                     → Active rides
/driver/ride               → Driver dashboard
/driver/earnings           → Earnings from rides
/places                    → Places / Favorites
/messages                  → Messaging
/auth/login                → Login
```

**API Calls Go To:** `NEXT_PUBLIC_API_URL`  
**Example:** `https://api.kaalay.com/api/v1/rides/create`

---

### **NEW Delivery Routes** (Suqafuran Express - use Suqafuran backend)
```
/driver/delivery           → Delivery dashboard + job offers
/driver/delivery/[id]      → Delivery detail + tracking
```

**API Calls Go To:** `NEXT_PUBLIC_DELIVERY_API`  
**Example:** `https://api.suqafuran.com:8006/v1/drivers/offers`

---

## 🔗 **API Endpoints Reference**

### **Kaalay Backend** (FastAPI)
```
POST   /api/v1/auth/send-otp
POST   /api/v1/auth/login
POST   /api/v1/rides
GET    /api/v1/rides/nearby
PATCH  /api/v1/rides/{id}/accept
GET    /api/v1/places
```

**See Full Docs:** OpenAPI at `https://api.kaalay.com/openapi.json`

### **Suqafuran Express Backend** (Go)
```
GET    /v1/drivers/offers                → Job offers
POST   /v1/drivers/offers/{id}/accept    → Accept delivery
GET    /v1/drivers/deliveries/active     → Active deliveries
PATCH  /v1/drivers/deliveries/{id}/status → Update status
GET    /v1/drivers/earnings              → Earnings
```

**See Full Docs:** Check `/Users/mac/suqafuran-express/README.md`

---

## 🌍 **Environment Variables Setup**

### **For Vercel Production** ✅ LIVE

```bash
# Kaalay APIs (Kaalay backend at Suqafuran server)
NEXT_PUBLIC_API_URL=https://app.suqafuran.com/api/v1

# Suqafuran Express APIs (Same server)
NEXT_PUBLIC_DELIVERY_API=https://app.suqafuran.com
NEXT_PUBLIC_DELIVERY_WS=wss://app.suqafuran.com
```

**Status:** ✅ Unified backend at https://app.suqafuran.com  
- Kaalay paths: `/api/v1/*` (rides, marketplace, users)
- Suqafuran paths: `/v1/*` (deliveries, payments, tracking)
**API Docs:** https://app.suqafuran.com/docs

### **For Local Development**

```bash
# Kaalay APIs (Local)
NEXT_PUBLIC_API_URL=http://localhost:5000

# Suqafuran Express APIs (Local)
NEXT_PUBLIC_DELIVERY_API=http://localhost:8006
NEXT_PUBLIC_DELIVERY_WS=ws://localhost:8007
```

---

## 📊 **Feature Distribution**

| Feature | Backend | Route | API |
|---------|---------|-------|-----|
| Ride Hailing | Kaalay | `/rides` | `POST /api/v1/rides` |
| Browse Stores | Kaalay | `/places` | `GET /api/v1/places` |
| User Profile | Kaalay | `/profile` | `PATCH /api/v1/auth/me` |
| **Delivery Offers** | **Suqafuran** | **/driver/delivery** | **GET /v1/drivers/offers** |
| **Delivery Tracking** | **Suqafuran** | **/driver/delivery/[id]** | **GET /v1/drivers/deliveries** |
| **Delivery Earnings** | **Suqafuran** | **/driver/delivery** | **GET /v1/drivers/earnings** |

---

## 🚀 **Deployment Architecture**

```
┌──────────────────────────────────────────────────────────┐
│                   VERCEL (Frontend)                      │
│                 kaalay.vercel.app                        │
│                                                          │
│  Single Next.js 15 App (8,250+ LOC)                     │
│  - Rides + Marketplace (existing)                       │
│  - Delivery Dashboard (new)                             │
│  - Real-time WebSocket                                 │
│                                                          │
└────────────┬─────────────────────────┬──────────────────┘
             │                         │
             ↓                         ↓
    ┌─────────────────┐      ┌─────────────────────┐
    │ KAALAY BACKEND  │      │ SUQAFURAN EXPRESS   │
    │                 │      │                     │
    │ FastAPI Server  │      │ Go Microservices    │
    │ (Existing)      │      │ (New)               │
    │                 │      │                     │
    │ Database:       │      │ Services:           │
    │ - PostgreSQL    │      │ - Driver :8006      │
    │ - Redis         │      │ - Merchant :8003    │
    │ - Socket.io     │      │ - Tracking :8007    │
    │                 │      │ - Messaging :8008   │
    │ API Port: 5000  │      │ - Payment :8010     │
    └─────────────────┘      └─────────────────────┘
```

---

## ✅ **Deployment Checklist**

### **Before Deploying to Vercel**

- [ ] Kaalay backend is running and accessible
- [ ] Suqafuran Express backend is running (all services)
- [ ] Environment variables set correctly in Vercel
- [ ] Local testing passes: `npm run build && npm start`
- [ ] Delivery features work at `/driver/delivery`

### **Environment Variables Checklist**

- [ ] `NEXT_PUBLIC_API_URL` points to Kaalay backend
- [ ] `NEXT_PUBLIC_DELIVERY_API` points to Suqafuran port 8006
- [ ] `NEXT_PUBLIC_DELIVERY_WS` points to Suqafuran WebSocket
- [ ] All URLs use HTTPS (except localhost)
- [ ] No trailing slashes on URLs

### **Post-Deployment Verification**

- [ ] Ride hailing features work (existing)
- [ ] Marketplace features work (existing)
- [ ] Delivery dashboard loads at `/driver/delivery`
- [ ] Can accept delivery offers
- [ ] Real-time updates work
- [ ] No console errors in browser

---

## 🔍 **Troubleshooting**

### **Delivery Features Not Loading**

```
1. Check environment variables in Vercel Settings
2. Verify NEXT_PUBLIC_DELIVERY_API is set
3. Test: curl https://api.suqafuran.com:8006/health
4. Check browser console for API errors
```

### **API Calls Failing**

```
✅ For Kaalay routes: Check NEXT_PUBLIC_API_URL
✅ For Delivery routes: Check NEXT_PUBLIC_DELIVERY_API
✅ Verify both backends are running
✅ Check CORS headers
```

### **WebSocket Not Connecting**

```
1. Verify NEXT_PUBLIC_DELIVERY_WS is set
2. Use wss:// in production (not ws://)
3. Check backend WebSocket port is open (8007)
4. Monitor browser Network tab → WS connections
```

---

## 📚 **Documentation Files**

- **Quick Deploy:** `/Users/mac/kaalay/DEPLOY.md`
- **Full Deploy Guide:** `/Users/mac/kaalay/apps/frontend-v2/KAALAY_DEPLOYMENT_GUIDE.md`
- **Integration Details:** `/Users/mac/kaalay/apps/frontend-v2/SUQAFURAN_EXPRESS_INTEGRATION.md`
- **Suqafuran Standalone:** `/Users/mac/suqafuran/new-frontend/DEPLOYMENT_GUIDE.md`

---

## 🎯 **Summary**

| Aspect | Details |
|--------|---------|
| **Frontend** | Single Next.js 15 app (Vercel) |
| **Kaalay Backend** | FastAPI (existing) - rides, marketplace |
| **Suqafuran Backend** | Go microservices (new) - deliveries |
| **Authentication** | JWT tokens (shared in localStorage) |
| **Database** | Separate DBs (Kaalay ≠ Suqafuran) |
| **Deployment** | Vercel (frontend) + own servers (backends) |
| **Real-time** | WebSocket to Suqafuran (tracking, messaging) |

---

**Status:** ✅ Ready for Production  
**Last Updated:** 2026-06-27
