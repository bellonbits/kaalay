# Kaalay Consolidation Migration Plan

**Goal:** Merge Suqafuran Express into Kaalay monorepo structure

---

## 📋 Phase 1: Frontend Migration

### Step 1: Backup old frontend
```bash
cd /Users/mac/kaalay/apps
mv frontend frontend.backup
```

### Step 2: Copy frontend-v2 to frontend
```bash
cp -r frontend-v2 frontend
cd frontend
# Remove node_modules to save space
rm -rf node_modules .next
npm install
```

### Step 3: Update environment variables
File: `frontend/.env.local`
```
NEXT_PUBLIC_API_URL=https://app.suqafuran.com/api/v1
NEXT_PUBLIC_DELIVERY_API=https://app.suqafuran.com
NEXT_PUBLIC_DELIVERY_WS=wss://app.suqafuran.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-key>
NEXT_PUBLIC_W3W_API_KEY=<your-key>
```

### Step 4: Update package.json
- Change name from "new-frontend" to "kaalay-frontend"
- Update scripts if needed

### Step 5: Verify frontend works
```bash
npm run build
npm start
# Test: http://localhost:3000/driver/delivery
```

---

## 📦 Phase 2: Backend Migration

### Step 1: Backup current backend
```bash
cd /Users/mac/kaalay/apps
mv backend backend.backup
```

### Step 2: Copy Suqafuran Express Go services to backend
```bash
mkdir -p backend
cp -r /Users/mac/suqafuran-express/services backend/
cp -r /Users/mac/suqafuran-express/shared backend/
cp /Users/mac/suqafuran-express/go.work backend/
```

### Step 3: Create unified docker-compose
```bash
cp /Users/mac/suqafuran-express/docker-compose.yml /Users/mac/kaalay/
```

### Step 4: Copy migrations
```bash
cp -r /Users/mac/suqafuran-express/infra/migrations backend/
```

### Step 5: Copy infrastructure configs
```bash
mkdir -p infra
cp -r /Users/mac/suqafuran-express/infra/k8s infra/
cp -r /Users/mac/suqafuran-express/infra/monitoring infra/
cp -r /Users/mac/suqafuran-express/infra/nginx infra/
```

### Step 6: Copy deployment scripts
```bash
mkdir -p scripts
cp /Users/mac/suqafuran-express/scripts/* scripts/
```

---

## 🔧 Phase 3: Configuration Consolidation

### Step 1: Create root docker-compose.yml
- Include both frontend and Go services
- Configure all 11 Go microservices
- Include PostgreSQL, Redis, NATS

### Step 2: Update root .env
```
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# NATS
NATS_URL=nats://...

# Services
MPESA_KEY=...
MPESA_SECRET=...
FCM_KEY=...
SENDGRID_KEY=...
```

### Step 3: Root package.json with scripts
```json
{
  "scripts": {
    "dev:frontend": "cd apps/frontend && npm run dev",
    "dev:backend": "docker-compose up",
    "build:frontend": "cd apps/frontend && npm run build",
    "build:images": "bash scripts/build-images.sh",
    "deploy:staging": "bash scripts/deploy-staging.sh"
  }
}
```

### Step 4: Update root README
- Single overview of entire platform
- Links to frontend and backend setup
- Docker Compose quickstart

---

## 🧹 Phase 4: Cleanup

### Step 1: Remove old directories
```bash
rm -rf apps/frontend-v2
rm -rf apps/frontend.backup  (after verification)
rm -rf apps/backend.backup   (after verification)
```

### Step 2: Remove separate repo
```bash
rm -rf /Users/mac/suqafuran-express
# (or archive it)
```

### Step 3: Update documentation
- Update all README files to reflect new structure
- Update deployment guides
- Update contributing guidelines

---

## ✅ Final Structure

```
/Users/mac/kaalay/
├── apps/
│   ├── frontend/          (Next.js 15 with delivery features)
│   │   ├── src/app/
│   │   │   ├── driver/delivery
│   │   │   ├── merchant/
│   │   │   └── ... (all Kaalay routes)
│   │   ├── package.json
│   │   └── .env.local
│   │
│   └── backend/           (All Go microservices)
│       ├── services/
│       │   ├── auth/
│       │   ├── gateway/
│       │   ├── driver/
│       │   ├── payment/
│       │   ├── tracking/
│       │   ├── messaging/
│       │   ├── notification/
│       │   └── ... (all 11 services)
│       ├── shared/
│       ├── migrations/
│       └── go.work
│
├── infra/
│   ├── k8s/
│   ├── monitoring/
│   └── migrations/
│
├── scripts/
│   ├── build-images.sh
│   ├── deploy-staging.sh
│   └── integration-test.sh
│
├── docker-compose.yml     (unified)
├── package.json           (root)
├── go.work                (root)
├── .env.local
├── README.md              (consolidated)
└── DEPLOYMENT_GUIDE.md
```

---

## 🚀 Deployment After Migration

```bash
# One-command dev environment
docker-compose up

# One-command production build
npm run build:images

# One-command staging deploy
npm run deploy:staging
```

---

## ⚠️ Important Notes

1. **Frontend URL:** Still deploys to `https://kaalay.vercel.app`
2. **Backend URL:** Still runs at `https://app.suqafuran.com`
3. **No API change:** Frontend env vars stay the same
4. **Single repo:** Everything in `/Users/mac/kaalay/`
5. **Easier to maintain:** One git history, one deployment pipeline

---

## 📅 Execution Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Frontend migration | 30 min |
| 2 | Backend migration | 30 min |
| 3 | Configuration consolidation | 30 min |
| 4 | Cleanup & testing | 30 min |
| **Total** | | **2 hours** |

---

**Status:** Ready to execute  
**Next:** Confirm plan, then proceed with Phase 1
