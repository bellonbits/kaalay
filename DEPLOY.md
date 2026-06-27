# 🚀 Quick Deploy Guide — Kaalay + Suqafuran Express

**TL;DR:** 3 commands to deploy Kaalay with integrated Suqafuran Express delivery features.

---

## Deploy to Vercel in 3 Steps

### Step 1: Commit Code
```bash
cd /Users/mac/kaalay
git add .
git commit -m "feat: Integrate Suqafuran Express delivery features"
git push origin main
```

### Step 2: Set Environment Variables

**Go to Vercel Dashboard:**
1. Visit: https://vercel.com
2. Select "frontend-v2" project
3. Settings → Environment Variables
4. Add these variables:

```
NEXT_PUBLIC_DELIVERY_API = https://api.suqafuran.com:8006
NEXT_PUBLIC_DELIVERY_WS = wss://api.suqafuran.com:8007
```

**Save → Deployments → Redeploy latest**

### Step 3: Done! 🎉

Visit: https://kaalay.vercel.app

**Try the new features:**
- Login → Navigate to `/driver/delivery`
- See Suqafuran Express delivery dashboard
- Accept delivery jobs
- Track deliveries

---

## What Gets Deployed

✅ **Existing Kaalay Features**
- Ride hailing
- Marketplace
- User profiles
- Messages

✅ **NEW: Suqafuran Express Delivery**
- Job offers dashboard
- Delivery tracking
- Earnings management
- Real-time updates

---

## Verify Deployment

```bash
# Check build status
vercel deployments

# View live logs
vercel logs --prod

# Test endpoint
curl https://kaalay.vercel.app
```

---

## If Deployment Fails

**Check error in Vercel Dashboard → Deployments → Click build → View logs**

**Common Issues:**

| Error | Fix |
|-------|-----|
| Missing env vars | Add `NEXT_PUBLIC_DELIVERY_API` in Settings |
| Build timeout | Increase timeout or optimize imports |
| API unreachable | Verify backend is running at `api.suqafuran.com:8006` |

---

## Local Testing (Before Deploy)

```bash
cd /Users/mac/kaalay/apps/frontend-v2

# Install
npm install

# Build (catches errors early)
npm run build

# Run locally
npm start

# Visit http://localhost:3000/driver/delivery
```

---

**Status:** ✅ Ready to Deploy  
**See Full Guide:** `apps/frontend-v2/KAALAY_DEPLOYMENT_GUIDE.md`
