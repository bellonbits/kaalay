#!/bin/bash

# Fix Podman deployment issues on DigitalOcean Droplet
# Run this script on your server: bash scripts/fix-podman-deployment.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔧 Fixing Podman Configuration${NC}"
echo ""

# Step 1: Configure Podman registries for short-name resolution
echo "📝 Step 1: Configuring Podman registries..."
cat > /etc/containers/registries.conf << 'EOF'
# Podman and Buildah search registries for short-name resolution
[registries.search]
registries = ["docker.io"]

[registries.insecure]
registries = []

[registries.block]
registries = []
EOF
echo -e "${GREEN}✅ Registries configured${NC}"
echo ""

# Step 2: Clean up dangling containers
echo "🧹 Step 2: Cleaning up dangling containers..."
podman-compose down 2>/dev/null || true
podman container prune -f 2>/dev/null || true
echo -e "${GREEN}✅ Dangling containers removed${NC}"
echo ""

# Step 3: Restart Podman daemon
echo "🔄 Step 3: Restarting Podman daemon..."
systemctl restart podman 2>/dev/null || true
sleep 2
echo -e "${GREEN}✅ Podman daemon restarted${NC}"
echo ""

# Step 4: Test Podman
echo "🧪 Step 4: Testing Podman..."
if podman pull alpine:latest > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Podman working correctly${NC}"
else
    echo -e "${RED}❌ Podman test failed${NC}"
    exit 1
fi
echo ""

# Step 5: Remove old images to free space
echo "💾 Step 5: Cleaning up old images..."
podman image prune -a -f 2>/dev/null || true
FREED=$(du -sh /var/lib/containers 2>/dev/null | cut -f1)
echo -e "${GREEN}✅ Old images cleaned${NC}"
echo ""

# Step 6: Verify deployment directory
echo "📁 Step 6: Verifying kaalay directory..."
if [ -d "/root/kaalay" ]; then
    echo -e "${GREEN}✅ /root/kaalay found${NC}"
    cd /root/kaalay

    if [ -f "docker-compose.yml" ]; then
        echo -e "${GREEN}✅ docker-compose.yml found${NC}"
    else
        echo -e "${RED}❌ docker-compose.yml not found${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ /root/kaalay not found${NC}"
    exit 1
fi
echo ""

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Podman Fixed!                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Create .env file:"
echo "     cp .env.example .env"
echo "     nano .env  # Add your API keys"
echo ""
echo "  2. Try deployment again:"
echo "     podman-compose up --build"
echo ""
echo "  3. Or use the automated script:"
echo "     bash scripts/deploy-droplet.sh app.suqafuran.com .env"
echo ""
