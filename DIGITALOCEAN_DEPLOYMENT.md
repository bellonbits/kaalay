# 🚀 Deploy Backend to DigitalOcean

**Complete guide for deploying Kaalay Go microservices to DigitalOcean**

---

## 📋 Deployment Options

| Option | Cost | Ease | Scalability | Best For |
|--------|------|------|-------------|----------|
| **Droplet + Podman** | $$ | Easy | Medium | Current setup (fastest) |
| **App Platform** | $$ | Easy | High | Managed, auto-scaling |
| **Kubernetes (DOKS)** | $$$  | Hard | Very High | Production scale |
| **Docker Compose** | $ | Easy | Low | Dev/staging |

---

## 🎯 Option 1: Droplet + Podman (RECOMMENDED)

**Current setup. Fastest deployment.**

### Prerequisites
- DigitalOcean account with existing Droplet
- SSH access to server
- Podman installed (`podman --version`)

### Step 1: SSH into Your Server

```bash
ssh root@app.suqafuran.com
# or
ssh -i ~/.ssh/id_rsa root@<DROPLET_IP>
```

### Step 2: Pull Latest Code

```bash
cd /root/kaalay

# Pull latest changes
git pull origin main

# Verify backend services present
ls -la apps/backend/services/
```

### Step 3: Set Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit with real values
nano .env
# Set:
# - POSTGRES_PASSWORD
# - JWT_SECRET
# - MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET
# - FCM_KEY, SENDGRID_API_KEY, AFRICASTALKING_API_KEY
# - GOOGLE_MAPS_API_KEY
# Exit: Ctrl+X → Y → Enter
```

### Step 4: Build Docker Images

```bash
# Option A: Using Podman (if already installed)
podman-compose build

# Option B: Using Docker (if Docker installed)
docker-compose build

# This takes 5-10 minutes, pulls base images and builds all 11 services
```

### Step 5: Start All Services

```bash
# Start in background
podman-compose up -d

# Verify all services are running
podman-compose ps

# Check logs
podman-compose logs -f

# Expected output:
# gateway        Up 2 minutes
# auth           Up 2 minutes
# user           Up 2 minutes
# merchant       Up 2 minutes
# order          Up 2 minutes
# dispatch       Up 2 minutes
# driver         Up 2 minutes
# tracking       Up 2 minutes
# messaging      Up 2 minutes
# notification   Up 2 minutes
# payment        Up 2 minutes
# postgres       Up 5 minutes (Healthy)
# redis          Up 5 minutes (Healthy)
# nats           Up 5 minutes (Healthy)
# minio          Up 5 minutes (Healthy)
```

### Step 6: Verify Services Are Healthy

```bash
# Check Gateway (main entry point)
curl http://localhost:8000/health

# Check Auth service
curl http://localhost:8001/health

# Check Driver service
curl http://localhost:8006/health

# All should return: {"status":"healthy"}
```

### Step 7: Enable Firewall & SSL (Production)

```bash
# Allow necessary ports (already done in production?)
ufw allow 80/tcp      # HTTP (gateway)
ufw allow 443/tcp     # HTTPS (nginx/reverse proxy)
ufw allow 22/tcp      # SSH

# Do NOT expose individual service ports (8001-8010) publicly
# Only gateway (8000) should be proxied through Nginx
```

### Step 8: Setup Nginx Reverse Proxy

Create `/etc/nginx/sites-available/api.suqafuran.com`:

```nginx
upstream gateway {
    server localhost:8000;
}

server {
    listen 80;
    listen [::]:80;
    server_name app.suqafuran.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.suqafuran.com;

    # SSL certificates (get from Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/app.suqafuran.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.suqafuran.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Gzip compression
    gzip on;
    gzip_types application/json text/plain;
    gzip_min_length 1000;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req zone=api burst=200 nodelay;

    location / {
        proxy_pass http://gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # WebSocket support (tracking & messaging)
    location ~ ^/(ws|tracking|messages) {
        proxy_pass http://gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/api.suqafuran.com /etc/nginx/sites-enabled/
nginx -t  # Verify config
systemctl restart nginx
```

### Step 9: Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Get certificate
certbot certonly --nginx -d app.suqafuran.com

# Auto-renew (runs daily)
systemctl enable certbot.timer
systemctl start certbot.timer
```

### Step 10: Auto-Restart on Reboot

Create systemd service `/etc/systemd/system/kaalay-backend.service`:

```ini
[Unit]
Description=Kaalay Backend Services
After=network.target

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
```

Enable:
```bash
systemctl daemon-reload
systemctl enable kaalay-backend
systemctl start kaalay-backend
```

---

## 🎯 Option 2: App Platform (Managed - Easiest)

**DigitalOcean's managed container platform. Best for auto-scaling.**

### Step 1: Create App on DigitalOcean

1. Visit: https://cloud.digitalocean.com/apps
2. Click **Create App**
3. Connect GitHub repository

### Step 2: Configure Services

For each of 11 services, set:

```yaml
name: gateway
source:
  github:
    repo: bellonbits/kaalay
    branch: main
build_command: |
    cd apps/backend/services/gateway
    go build -o gateway .
run_command: ./gateway
envs:
  - key: PORT
    value: "8000"
  - key: DATABASE_URL
    scope: RUN_AND_BUILD_TIME
    value: ${db.DATABASE_URL}
```

### Step 3: Add Database

1. Click **Create Component**
2. Select **Database** → **PostgreSQL**
3. Set cluster name: `kaalay-postgres`
4. Set version: 16

### Step 4: Deploy

Click **Deploy** → Wait 10-15 minutes

All services auto-scale based on load.

---

## 🎯 Option 3: Kubernetes (DOKS - High Scale)

**For large production deployments with 100k+ daily users.**

### Prerequisites

```bash
# Install doctl
brew install doctl

# Authenticate
doctl auth init

# Install kubectl
brew install kubectl
```

### Step 1: Create DOKS Cluster

```bash
# Create 3-node cluster (load-balanced, HA)
doctl kubernetes cluster create kaalay-prod \
  --region sfo3 \
  --node-pool name=backend,size=s-2vcpu-4gb,count=3,auto-scale=true,min-nodes=3,max-nodes=10

# Get kubeconfig
doctl kubernetes cluster kubeconfig save kaalay-prod
```

### Step 2: Create Namespace

```bash
kubectl create namespace kaalay
kubectl config set-context --current --namespace=kaalay
```

### Step 3: Setup Database (Managed)

```bash
# Create managed PostgreSQL
doctl databases create kaalay-postgres \
  --engine pg \
  --version 16 \
  --region sfo3 \
  --num-nodes 3

# Get connection string
doctl databases connection kaalay-postgres
```

### Step 4: Deploy Services

```bash
# Apply Kubernetes manifests
kubectl apply -f apps/backend/infra/k8s/

# Verify deployments
kubectl get deployments
kubectl get pods
kubectl get services
```

### Step 5: Setup Ingress (Load Balancer)

Create `ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - app.suqafuran.com
    secretName: api-tls
  rules:
  - host: app.suqafuran.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gateway
            port:
              number: 8000
```

Apply:
```bash
kubectl apply -f ingress.yaml
```

---

## 📊 Monitoring & Logs

### View Logs (All Options)

```bash
# Podman/Docker
podman-compose logs -f gateway

# Kubernetes
kubectl logs -f deployment/gateway

# Follow specific service
kubectl logs -f -l app=gateway
```

### Setup Monitoring

```bash
# Deploy Prometheus + Grafana
kubectl apply -f apps/backend/infra/monitoring/

# Access Grafana
kubectl port-forward svc/grafana 3000:3000
# Visit: http://localhost:3000
# Default: admin/admin
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions (Auto Deploy on Push)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'apps/backend/**'
      - 'docker-compose.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build images
        run: |
          cd apps/backend
          docker-compose build
      
      - name: Push to Docker Hub
        run: |
          docker login -u ${{ secrets.DOCKER_USER }} -p ${{ secrets.DOCKER_PASS }}
          docker-compose push
      
      - name: Deploy to DigitalOcean
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.DO_SSH_KEY }}" > ~/.ssh/do_key
          chmod 600 ~/.ssh/do_key
          ssh -i ~/.ssh/do_key root@app.suqafuran.com "cd /root/kaalay && git pull && podman-compose down && podman-compose pull && podman-compose up -d"
```

Set secrets in GitHub:
- `DOCKER_USER`, `DOCKER_PASS` - Docker Hub credentials
- `DO_SSH_KEY` - Private SSH key for DigitalOcean server

---

## 🚨 Troubleshooting

### Services won't start

```bash
# Check logs
podman-compose logs gateway

# Common issues:
# 1. Database not ready
podman-compose logs postgres

# 2. Port already in use
lsof -i :8000

# 3. Env vars not set
cat .env | grep JWT_SECRET
```

### Database connection fails

```bash
# Verify database is running
podman-compose ps postgres

# Check connection
psql -h localhost -U kaalay -d kaalay_delivery

# Run migrations
podman-compose exec postgres psql -U kaalay -d kaalay_delivery -f /migrations/001_init.up.sql
```

### WebSocket not working

```bash
# Check tracking service
podman-compose logs tracking

# Test connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8007/ws/driver/test
```

### Out of memory

```bash
# Increase Docker memory limit
# Edit /etc/docker/daemon.json:
{
  "memory": "16g",
  "memswap": "16g"
}

# Restart Docker
systemctl restart docker
```

---

## 📈 Production Checklist

- [ ] Environment variables set (.env)
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Nginx reverse proxy configured
- [ ] Firewall rules applied (only 80, 443 public)
- [ ] Database backups enabled
- [ ] Monitoring setup (Prometheus/Grafana)
- [ ] Logging aggregated (ELK or CloudWatch)
- [ ] Auto-restart enabled (systemd or K8s)
- [ ] Load balancer configured
- [ ] Health checks enabled
- [ ] Rate limiting configured
- [ ] CORS headers set

---

## 💰 Cost Estimate (Monthly)

### Option 1: Droplet + Podman
- 1x Droplet (4GB RAM, 2 CPU): $24/month
- 1x Managed PostgreSQL (4GB RAM): $30/month
- **Total: ~$54/month**

### Option 2: App Platform
- 11 services × $15/month: $165/month
- Managed database: included
- **Total: ~$165/month**

### Option 3: Kubernetes (DOKS)
- 3x Node (2GB, 1 CPU): $18/month × 3 = $54/month
- Managed PostgreSQL: $30/month
- Load balancer: $10/month
- **Total: ~$94/month** (scales to $500+ with more nodes)

---

## 🔄 Update/Rollback Process

### Update Backend

```bash
# Pull latest code
cd /root/kaalay && git pull

# Rebuild services
podman-compose build

# Stop old services
podman-compose down

# Start new services
podman-compose up -d

# Verify
podman-compose ps
```

### Rollback (if deployment fails)

```bash
# Revert to previous commit
git reset --hard HEAD~1

# Rebuild
podman-compose build

# Restart
podman-compose down && podman-compose up -d

# Verify logs
podman-compose logs -f
```

---

## 📞 Support

- **DigitalOcean Docs**: https://docs.digitalocean.com
- **Docker Docs**: https://docs.docker.com
- **Podman Docs**: https://docs.podman.io
- **Kubernetes Docs**: https://kubernetes.io/docs

---

**Status:** ✅ Ready to Deploy  
**Last Updated:** 2026-06-27  
**Recommendation:** Start with Option 1 (Droplet + Podman) for fastest deployment
