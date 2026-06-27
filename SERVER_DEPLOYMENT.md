# 🚀 Server Deployment Guide - Fix & Deploy

**Run these commands on your DigitalOcean Droplet to fix Podman issues and deploy successfully.**

---

## ⚠️ Current Issues

Your server has Podman issues:
1. `short-name "golang:1.24-alpine" did not resolve` - Registries not configured
2. `container already exists` - Dangling containers from previous attempts
3. `Dockerfile not found` - Build context issue

---

## ✅ Quick Fix (3 Steps)

### Step 1: SSH to Your Server

```bash
ssh root@app.suqafuran.com
# or
ssh -i ~/.ssh/id_rsa root@<YOUR_DROPLET_IP>
```

### Step 2: Run Fix Script

```bash
cd /root/kaalay

# Download & run the fix script
bash scripts/fix-podman-deployment.sh
```

This will:
- ✅ Configure Podman registries (allows short-name resolution)
- ✅ Clean up dangling containers
- ✅ Restart Podman daemon
- ✅ Test Podman is working
- ✅ Clean up old images (free space)

### Step 3: Deploy

```bash
# Create .env file
cp .env.example .env

# Edit with your API keys
nano .env
# Add: JWT_SECRET, MPESA_CONSUMER_KEY, etc.
# Exit: Ctrl+X → Y → Enter

# Deploy (takes 5-10 minutes)
podman-compose up --build

# Verify (in another terminal)
curl http://localhost:8000/health
```

---

## 🔧 Manual Fix (If Script Doesn't Work)

If the fix script fails, do this manually:

### 1. Configure Podman Registries

```bash
sudo tee /etc/containers/registries.conf > /dev/null << 'CONF'
[registries.search]
registries = ["docker.io"]

[registries.insecure]
registries = []

[registries.block]
registries = []
CONF
```

### 2. Clean Up Containers

```bash
cd /root/kaalay

# Stop all services
podman-compose down 2>/dev/null || true

# Remove dangling containers
podman container prune -f

# Remove dangling images
podman image prune -a -f
```

### 3. Restart Podman

```bash
systemctl restart podman
sleep 2

# Test
podman pull alpine:latest
```

### 4. Deploy

```bash
cp .env.example .env
nano .env  # Add API keys

podman-compose up --build
```

---

## 📋 Troubleshooting

### Issue: Still getting "short-name" error

**Solution:**

```bash
# Make sure registries.conf is set correctly
cat /etc/containers/registries.conf

# Should output:
# [registries.search]
# registries = ["docker.io"]

# If not, recreate it
sudo tee /etc/containers/registries.conf > /dev/null << 'CONF'
[registries.search]
registries = ["docker.io"]

[registries.insecure]
registries = []

[registries.block]
registries = []
CONF

# Restart Podman
systemctl restart podman
```

### Issue: "container already exists" error

**Solution:**

```bash
# Force remove all containers
podman rm -f $(podman ps -aq)

# Clear volume mounts
podman volume prune -f

# Try again
podman-compose up --build
```

### Issue: Out of disk space

**Solution:**

```bash
# Check disk usage
df -h

# If full, clean old images
podman image prune -a -f
podman volume prune -f

# Check again
df -h
```

### Issue: Build is very slow

**Solution:**

```bash
# This is normal for first build (5-10 minutes)
# Watch the logs
podman-compose logs -f

# Don't interrupt with Ctrl+C

# Wait for all services to be healthy
podman-compose ps
# Look for: "Up" status for all services
```

---

## ✅ Verify Deployment

Once deployment completes:

```bash
# Check services
podman-compose ps

# Expected output:
# NAME           STATUS
# kaalay-gateway Up 2 minutes
# kaalay-auth    Up 2 minutes
# kaalay-user    Up 2 minutes
# ... (all 11 services)

# Test API Gateway
curl http://localhost:8000/health
# Should return: {"status":"healthy"}

# View logs
podman-compose logs -f gateway

# Check specific service
curl http://localhost:8000/v1/drivers/offers
```

---

## 🔄 Enable Auto-Start on Reboot

To make services auto-start when droplet reboots:

```bash
# Create systemd service
sudo tee /etc/systemd/system/kaalay-backend.service > /dev/null << 'SERVICE'
[Unit]
Description=Kaalay Backend Services
After=network.target podman.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/kaalay
ExecStart=/usr/bin/podman-compose up
ExecStop=/usr/bin/podman-compose down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

# Enable
sudo systemctl daemon-reload
sudo systemctl enable kaalay-backend
sudo systemctl start kaalay-backend

# Check status
sudo systemctl status kaalay-backend
```

---

## 📊 Monitor Deployment

```bash
# Watch services in real-time
watch -n 2 'podman-compose ps'

# Follow logs (all services)
podman-compose logs -f

# Follow specific service
podman-compose logs -f gateway

# Check resource usage
podman stats

# Exit: Ctrl+C
```

---

## 🚨 Emergency Rollback

If something goes wrong:

```bash
# Stop all services
podman-compose down

# Revert code
git reset --hard HEAD~1

# Pull latest
git pull origin main

# Try again
podman-compose up --build
```

---

## 💡 Important Notes

1. **First Build Takes Time**: 5-10 minutes (normal, don't interrupt)
2. **Database Initialization**: PostgreSQL needs ~30s to be ready
3. **Service Startup**: Some services may take 1-2 minutes to fully start
4. **Logs**: Check `podman-compose logs` if services don't start
5. **Ports**: Gateway runs on port 8000, other services on 8001-8010

---

## 📞 Need Help?

**Check logs first:**
```bash
podman-compose logs -f gateway
# Look for error messages
```

**Common errors:**
- `database connection refused` - PostgreSQL not ready yet (wait 30s)
- `port already in use` - Another service using port (kill it)
- `OOM killer` - Out of memory (increase server size)
- `permission denied` - Run with `sudo`

---

## ✅ Deployment Complete

Once `curl http://localhost:8000/health` returns `{"status":"healthy"}`:

1. **Frontend**: https://kaalay.vercel.app
2. **API Gateway**: http://localhost:8000
3. **API Docs**: http://localhost:8000/docs (if available)

---

**Status:** ✅ Ready to Deploy  
**Time to Production:** 5-10 minutes  
**Next Step:** Run `bash scripts/fix-podman-deployment.sh`
