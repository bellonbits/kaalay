# Kaalay Deployment Guide — With Suqafuran Express Integration

**Status:** ✅ Ready to Deploy | **Platform:** Vercel | **Date:** 2026-06-27

---

## 🚀 Quick Deployment to Vercel

### Step 1: Commit Your Changes

```bash
cd /Users/mac/kaalay
git add .
git commit -m "feat: Integrate Suqafuran Express delivery features

- Add delivery dashboard at /driver/delivery
- Add delivery detail page at /driver/delivery/[id]
- Add delivery API service integration
- Drivers can now accept delivery jobs alongside rides
- Complete documentation and deployment guide"

git push origin main
```

### Step 2: Deploy to Vercel

**Option A: Via CLI (Fastest)**

```bash
# Install Vercel CLI globally (if needed)
npm i -g vercel

# Navigate to frontend-v2
cd /Users/mac/kaalay/apps/frontend-v2

# Deploy
vercel --prod

# You'll be prompted to:
# 1. Confirm project (should auto-detect: "frontend-v2")
# 2. Set environment variables (see below)
# 3. Confirm deployment
```

**Option B: Via GitHub (Recommended)**

```bash
# If connected to GitHub, Vercel auto-deploys on push
# No additional steps needed!

# Just push to main:
git push origin main

# Vercel automatically:
# 1. Triggers build
# 2. Runs tests
# 3. Deploys to production
# 4. Updates preview URLs
```

**Option C: Via Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com)
2. Login
3. Select "frontend-v2" project
4. Click "Deploy" or wait for auto-deploy
5. Set environment variables in project settings

---

## 🔐 Environment Variables

### Required for Suqafuran Express Integration

Add these to Vercel project settings:

```
# Suqafuran Express Delivery API
NEXT_PUBLIC_DELIVERY_API=https://api.suqafuran.com:8006
NEXT_PUBLIC_DELIVERY_WS=wss://api.suqafuran.com:8007

# Existing Kaalay APIs
NEXT_PUBLIC_API_URL=https://api.kaalay.com
NEXT_PUBLIC_SOCKET_URL=https://socket.kaalay.com

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_key_here

# Other services
NEXT_PUBLIC_SENTRY_DSN=optional
```

### How to Set Environment Variables in Vercel

1. **Go to Vercel Dashboard**
   - vercel.com → Select "frontend-v2" project
   - Settings → Environment Variables

2. **Add Each Variable**
   - Name: `NEXT_PUBLIC_DELIVERY_API`
   - Value: `https://api.suqafuran.com:8006`
   - Environments: Production, Preview, Development
   - Click "Save"

3. **Repeat for all variables above**

4. **Redeploy**
   - Deployments tab → Click "Redeploy" on latest deployment

---

## 📋 Pre-Deployment Checklist

- [ ] All code committed to Git
- [ ] No uncommitted changes (`git status` is clean)
- [ ] Environment variables set in Vercel dashboard
- [ ] Backend services running (or accessible at api.kaalay.com)
- [ ] Test locally: `npm run dev` works
- [ ] Type checking passes: `npm run build` succeeds
- [ ] No console errors in browser
- [ ] Delivery dashboard loads at `/driver/delivery`

---

## 🧪 Test After Deployment

### 1. Verify Build Succeeded
```
Vercel Dashboard → Deployments
Should show green checkmark ✅
```

### 2. Test Homepage
```
Visit: https://kaalay.vercel.app (or your custom domain)
Should load in < 3 seconds
```

### 3. Test Delivery Features
```
Navigate to: /driver/delivery
Should show:
- Job offers (if available)
- Active deliveries
- Today's earnings
- Online/Offline toggle
```

### 4. Test Delivery Detail
```
Click on a delivery
Should show:
- Customer info
- Route (pickup → delivery)
- Status buttons
- Delivery fee
```

### 5. Check Network Requests
```
Browser Console → Network tab
API calls should show:
✅ NEXT_PUBLIC_DELIVERY_API requests
✅ Status 200 (success)
✅ No CORS errors
```

---

## 🌐 Custom Domain Setup

### If Using Custom Domain (e.g., kaalay.app)

1. **Add Domain to Vercel**
   - Vercel Dashboard → Settings → Domains
   - Click "Add Domain"
   - Enter: `kaalay.app`

2. **Update DNS Records**
   - Go to your domain registrar
   - Add CNAME record:
     ```
     Type: CNAME
     Name: @ (or root)
     Value: cname.vercel-dns.com
     TTL: 3600
     ```

3. **SSL Certificate**
   - Vercel auto-provisions Let's Encrypt
   - HTTPS enabled automatically
   - Takes ~5-10 minutes

4. **Verify**
   - Visit: https://kaalay.app
   - Should load with green lock 🔒

---

## 📊 Monitoring After Deploy

### Vercel Analytics
- **Deployments tab** — View build logs, deployment status
- **Metrics tab** — Performance monitoring
- **Logs tab** — Runtime errors and API calls

### Real-time Monitoring
```bash
# View live logs
vercel logs --prod

# View last build output
vercel logs --prod --follow
```

### Common Issues

**Issue:** "Deployment Failed"
```
Solution:
1. Check Vercel Deployments tab for error
2. Usually missing env vars
3. Add env vars and redeploy
```

**Issue:** "API calls failing (CORS errors)"
```
Solution:
1. Verify NEXT_PUBLIC_DELIVERY_API is set
2. Check backend is accessible at that URL
3. Verify CORS headers on backend
```

**Issue:** "Page loads but no data"
```
Solution:
1. Check browser console for errors
2. Check Network tab → API responses
3. Verify authentication token is valid
```

---

## 🔄 Auto-Deployment

### GitHub Integration (Recommended)

```bash
# Connect GitHub repo to Vercel
# 1. Push code to GitHub
git push origin main

# 2. Vercel automatically:
#    - Detects new push
#    - Runs build
#    - Deploys to production
#    - Updates preview URLs

# 3. View deployment
vercel deployments
```

### Manual Redeploy

```bash
# If you need to redeploy without code changes
vercel --prod --force
```

---

## 📱 Mobile Verification

### Test on iOS
1. Visit: `https://kaalay.app` (or deployed URL)
2. Tap "Share" → "Add to Home Screen"
3. App installs as PWA
4. Tap to open
5. Test delivery features

### Test on Android
1. Visit: `https://kaalay.app`
2. Tap menu → "Install app"
3. App installs as PWA
4. Tap to open
5. Test delivery features

### Test in Chrome DevTools
```
1. Open DevTools (F12)
2. Device Toolbar (Cmd+Shift+M)
3. Test responsive design
4. Test touch interactions
5. Check Console for errors
```

---

## 🚨 Rollback (If Needed)

### Rollback to Previous Deployment

```bash
# View deployments
vercel deployments

# Select previous working deployment
# Vercel Dashboard → Deployments → Click deployment → "Promote to Production"

# Or via CLI
vercel rollback
```

### Manual Rollback

```bash
# Check git history
git log --oneline | head -5

# If major issue, revert commit
git revert HEAD
git push origin main

# Vercel auto-rebuilds
```

---

## 📈 Performance Optimization

### Vercel Built-in Optimizations
- ✅ Automatic image optimization (Next.js Image)
- ✅ Gzip compression
- ✅ Minified CSS/JS
- ✅ Code splitting
- ✅ CDN caching

### Monitor Performance
```
Vercel Dashboard → Analytics tab
View metrics:
- Page load time
- Time to interactive
- Cumulative layout shift
- First input delay
```

### Improve Performance
```
1. Enable ISR (Incremental Static Regeneration)
2. Optimize images (use Next.js Image)
3. Code split large components
4. Lazy load heavy libraries
5. Monitor Core Web Vitals
```

---

## 🔐 Security Checklist

- [ ] No hardcoded secrets (use env vars)
- [ ] HTTPS enforced (automatic)
- [ ] CORS properly configured
- [ ] JWT tokens in localStorage (acceptable for web)
- [ ] API keys not exposed in client code
- [ ] Rate limiting configured on backend
- [ ] Input validation on forms

---

## 📞 Support & Troubleshooting

### Quick Help

| Issue | Solution |
|-------|----------|
| Build fails | Check Vercel logs for details |
| API not found | Verify `NEXT_PUBLIC_DELIVERY_API` env var |
| Blank page | Check browser console for JS errors |
| Slow load | Check Vercel Analytics for bottlenecks |
| CORS error | Verify backend CORS headers |
| 404 on delivery page | Ensure routes exist in `/app/driver/delivery/` |

### Debug Locally Before Deploying

```bash
# Build locally to catch issues
npm run build

# Start production server locally
npm start

# Visit http://localhost:3000
# Test all features

# If works locally but fails on Vercel:
# 1. Check env vars are set
# 2. Clear cache: Vercel Dashboard → Settings → Build cache → Clear
# 3. Redeploy
```

### Get Help

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Kaalay Team:** Check `/Users/mac/kaalay/README.md`
- **Suqafuran Express:** Check `/Users/mac/suqafuran/new-frontend/DEPLOYMENT_GUIDE.md`

---

## ✅ Deployment Complete!

After following these steps, your Kaalay app with Suqafuran Express integration is live!

### What's Running
```
https://kaalay.app (or custom domain)
├── Existing Kaalay features
│   ├── Ride hailing
│   ├── Marketplace
│   └── User profile
└── NEW: Suqafuran Express Delivery
    ├── /driver/delivery (dashboard)
    ├── /driver/delivery/[id] (detail)
    └── Full delivery integration
```

### Users Can Now
- ✅ Do ride-hailing (existing)
- ✅ Browse marketplace (existing)
- ✅ Accept delivery jobs (NEW)
- ✅ Track deliveries in real-time (NEW)
- ✅ Manage earnings for both services (NEW)

---

**Deployment Status:** ✅ Ready  
**Last Updated:** 2026-06-27  
**Next Review:** 2026-07-04
