# 🚀 Deployment Scripts

Automated deployment scripts for Kaalay backend.

## Scripts

### `deploy-droplet.sh`

Deploy backend to DigitalOcean Droplet with a single command.

**Usage:**
```bash
bash scripts/deploy-droplet.sh [SERVER_IP] [ENV_FILE]
```

**Examples:**
```bash
# Deploy to production server
bash scripts/deploy-droplet.sh app.suqafuran.com .env

# Deploy to staging
bash scripts/deploy-droplet.sh staging.suqafuran.com .env.staging

# Use default server
bash scripts/deploy-droplet.sh
```

**What it does:**
1. ✅ Verifies SSH connection
2. ✅ Pulls latest code from GitHub
3. ✅ Copies .env file to server
4. ✅ Stops old services
5. ✅ Builds new Docker images
6. ✅ Starts new services
7. ✅ Waits for services to be healthy
8. ✅ Verifies all 11 services
9. ✅ Shows logs

**Requirements:**
- SSH access to server
- `podman-compose` or `docker-compose` on server
- `.env` file with production values

**Speed:** ~5-10 minutes (depending on image build time)

---

### `build-images.sh` (Optional)

Pre-build all Docker images locally before pushing.

```bash
bash scripts/build-images.sh
```

---

### `push-images.sh` (Optional)

Push images to Docker registry.

```bash
bash scripts/push-images.sh
```

Requires:
- Docker Hub account
- `DOCKER_USER` and `DOCKER_PASS` env vars

---

## 🔄 Deployment Workflow

### Quick Deployment (Recommended)

```bash
# 1. Commit changes
git add .
git commit -m "feat: Add new delivery features"
git push origin main

# 2. Deploy to production
bash scripts/deploy-droplet.sh app.suqafuran.com .env
```

### Full Deployment with Testing

```bash
# 1. Test locally
docker-compose up
# Test at http://localhost:8000

# 2. Commit
git add .
git commit -m "feat: ..."
git push

# 3. Deploy to staging
bash scripts/deploy-droplet.sh staging.suqafuran.com .env.staging

# 4. Test on staging
# Test at https://staging-api.suqafuran.com

# 5. Deploy to production
bash scripts/deploy-droplet.sh app.suqafuran.com .env
```

---

## 🚨 Troubleshooting

### SSH Connection Failed

```bash
# Check SSH access
ssh -v root@app.suqafuran.com

# If key is in non-standard location:
ssh -i ~/.ssh/custom_key root@app.suqafuran.com

# To use custom key with script:
export SSH_KEY=~/.ssh/custom_key
bash scripts/deploy-droplet.sh
```

### Build Fails

```bash
# Check disk space on server
ssh root@app.suqafuran.com "df -h"

# Clean up old images (if full)
ssh root@app.suqafuran.com "podman image prune -a"
```

### Services Won't Start

```bash
# Check logs
ssh root@app.suqafuran.com "cd /root/kaalay && podman-compose logs gateway"

# Common issues:
# - Database not migrated
# - Port already in use
# - Environment variables missing
```

### Rollback Failed Deployment

```bash
# SSH to server
ssh root@app.suqafuran.com

# Go to app directory
cd /root/kaalay

# Revert to previous version
git reset --hard HEAD~1

# Rebuild and restart
podman-compose build
podman-compose down
podman-compose up -d
```

---

## 📊 Script Output Example

```
╔════════════════════════════════════════╗
║  Kaalay Backend Deployment Script      ║
╚════════════════════════════════════════╝

📍 Server: app.suqafuran.com
👤 User: root
📁 Deploy Path: /root/kaalay
⚙️  Env File: .env

🔐 Testing SSH connection...
✅ SSH connection successful

📥 Step 1: Pulling latest code...
✅ Code pulled

⚙️  Step 2: Checking environment file...
📤 Copying .env to server...
✅ Environment file updated

⛔ Step 3: Stopping old services...
✅ Services stopped

🔨 Step 4: Building Docker images...
✅ Images built

🚀 Step 5: Starting services...
✅ Services started

⏳ Step 6: Waiting for services to become healthy...
✅ Gateway is healthy

🔍 Step 7: Verifying services...

Service Status:
CONTAINER ID  IMAGE                           STATUS
abc123...     localhost/kaalay-gateway        Up 2 minutes
def456...     localhost/kaalay-auth           Up 2 minutes
...

💓 Step 8: Running health checks...
✅ gateway (port 8000)
✅ auth (port 8001)
✅ user (port 8002)
✅ merchant (port 8003)
✅ order (port 8004)
✅ dispatch (port 8005)
✅ driver (port 8006)
✅ tracking (port 8007)
✅ messaging (port 8008)
✅ notification (port 8009)
✅ payment (port 8010)

╔════════════════════════════════════════╗
║  ✅ Deployment Complete!              ║
╚════════════════════════════════════════╝

📍 Frontend URL: https://kaalay.vercel.app
🔗 API Gateway: https://app.suqafuran.com
📊 API Docs: https://app.suqafuran.com/docs
```

---

## 🔐 Environment Variables

All scripts require `.env` file with:

```bash
# Database
POSTGRES_PASSWORD=<your-password>

# JWT
JWT_SECRET=<your-secret>

# Payment
MPESA_CONSUMER_KEY=<key>
MPESA_CONSUMER_SECRET=<secret>

# Notifications
FCM_KEY=<firebase-key>
SENDGRID_API_KEY=<sendgrid-key>
AFRICASTALKING_API_KEY=<at-key>
```

---

**Status:** ✅ Ready to Deploy  
**Last Updated:** 2026-06-27
