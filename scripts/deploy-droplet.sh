#!/bin/bash

# Kaalay Backend Deployment Script for DigitalOcean Droplet
# Usage: bash scripts/deploy-droplet.sh <SERVER_IP> [ENV_FILE]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_IP=${1:-app.suqafuran.com}
SSH_USER=${SSH_USER:-root}
DEPLOY_PATH=${DEPLOY_PATH:-/root/kaalay}
ENV_FILE=${2:-.env}

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Kaalay Backend Deployment Script      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📍 Server: $SERVER_IP"
echo "👤 User: $SSH_USER"
echo "📁 Deploy Path: $DEPLOY_PATH"
echo "⚙️  Env File: $ENV_FILE"
echo ""

# Verify SSH access
echo "🔐 Testing SSH connection..."
if ! ssh -q "$SSH_USER@$SERVER_IP" exit; then
    echo -e "${RED}❌ Cannot connect to $SERVER_IP${NC}"
    echo "Please verify:"
    echo "  1. Server IP is correct"
    echo "  2. SSH key is in ~/.ssh/"
    echo "  3. You have network access"
    exit 1
fi
echo -e "${GREEN}✅ SSH connection successful${NC}"
echo ""

# Step 1: Pull latest code
echo "📥 Step 1: Pulling latest code..."
ssh "$SSH_USER@$SERVER_IP" "cd $DEPLOY_PATH && git pull origin main" || {
    echo -e "${RED}❌ Failed to pull code${NC}"
    exit 1
}
echo -e "${GREEN}✅ Code pulled${NC}"
echo ""

# Step 2: Update environment file
echo "⚙️  Step 2: Checking environment file..."
if [ -f "$ENV_FILE" ]; then
    echo "📤 Copying .env to server..."
    scp "$ENV_FILE" "$SSH_USER@$SERVER_IP:$DEPLOY_PATH/.env"
    echo -e "${GREEN}✅ Environment file updated${NC}"
else
    echo -e "${YELLOW}⚠️  $ENV_FILE not found locally${NC}"
    echo "Using existing .env on server"
    ssh "$SSH_USER@$SERVER_IP" "test -f $DEPLOY_PATH/.env && echo '✅ Existing .env found' || echo '❌ No .env file found!'"
fi
echo ""

# Step 3: Stop old services
echo "⛔ Step 3: Stopping old services..."
ssh "$SSH_USER@$SERVER_IP" "cd $DEPLOY_PATH && podman-compose down || true" || true
echo -e "${GREEN}✅ Services stopped${NC}"
echo ""

# Step 4: Build new images
echo "🔨 Step 4: Building Docker images..."
ssh "$SSH_USER@$SERVER_IP" "cd $DEPLOY_PATH && podman-compose build" || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}
echo -e "${GREEN}✅ Images built${NC}"
echo ""

# Step 5: Start services
echo "🚀 Step 5: Starting services..."
ssh "$SSH_USER@$SERVER_IP" "cd $DEPLOY_PATH && podman-compose up -d" || {
    echo -e "${RED}❌ Failed to start services${NC}"
    exit 1
}
echo -e "${GREEN}✅ Services started${NC}"
echo ""

# Step 6: Wait for services to be healthy
echo "⏳ Step 6: Waiting for services to become healthy..."
for i in {1..30}; do
    if ssh "$SSH_USER@$SERVER_IP" "curl -s http://localhost:8000/health > /dev/null 2>&1"; then
        echo -e "${GREEN}✅ Gateway is healthy${NC}"
        break
    fi
    if [ $i -lt 30 ]; then
        echo "  Attempt $i/30... waiting for gateway"
        sleep 2
    else
        echo -e "${YELLOW}⚠️  Gateway not ready yet, continuing...${NC}"
    fi
done
echo ""

# Step 7: Verify services
echo "🔍 Step 7: Verifying services..."
echo ""
echo "Service Status:"
ssh "$SSH_USER@$SERVER_IP" "cd $DEPLOY_PATH && podman-compose ps" | tail -15
echo ""

# Step 8: Health checks
echo "💓 Step 8: Running health checks..."
echo ""

SERVICES=(
    "gateway:8000"
    "auth:8001"
    "user:8002"
    "merchant:8003"
    "order:8004"
    "dispatch:8005"
    "driver:8006"
    "tracking:8007"
    "messaging:8008"
    "notification:8009"
    "payment:8010"
)

for service in "${SERVICES[@]}"; do
    name="${service%:*}"
    port="${service#*:}"

    if ssh "$SSH_USER@$SERVER_IP" "curl -s http://localhost:$port/health > /dev/null 2>&1"; then
        echo -e "${GREEN}✅${NC} $name (port $port)"
    else
        echo -e "${YELLOW}⏳${NC} $name (port $port) - starting"
    fi
done
echo ""

# Step 9: Show logs
echo "📋 Step 9: Latest logs:"
echo ""
ssh "$SSH_USER@$SERVER_IP" "cd $DEPLOY_PATH && podman-compose logs -n 20" | tail -30
echo ""

# Final summary
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Deployment Complete!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📍 Frontend URL: https://kaalay.vercel.app"
echo "🔗 API Gateway: https://app.suqafuran.com"
echo "📊 API Docs: https://app.suqafuran.com/docs"
echo ""
echo "🔍 Next Steps:"
echo "  1. Verify frontend can reach API:"
echo "     curl https://app.suqafuran.com/health"
echo ""
echo "  2. Check service logs:"
echo "     ssh $SSH_USER@$SERVER_IP 'cd $DEPLOY_PATH && podman-compose logs -f gateway'"
echo ""
echo "  3. Rollback (if needed):"
echo "     ssh $SSH_USER@$SERVER_IP 'cd $DEPLOY_PATH && git reset --hard HEAD~1 && podman-compose build && podman-compose up -d'"
echo ""
echo "✅ Deployment successful! 🎉"
