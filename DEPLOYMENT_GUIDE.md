# Deployment Guide

Complete guide to deploy the YouTube Comments Extension to production.

---

## Architecture Overview

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Chrome Extension  │────▶│   Backend Server    │────▶│   PostgreSQL DB     │
│   (Chrome Store)    │     │   (Railway/Render)  │     │   (Supabase/Neon)   │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

## Step 1: Deploy Database (PostgreSQL)

### Option A: Supabase (Recommended - Free)

1. Go to [supabase.com](https://supabase.com) → Create account
2. Create new project → Choose region
3. Go to **Settings → Database → Connection string (URI)**
4. Copy the connection string, replace `[YOUR-PASSWORD]`
5. Save this as your `DATABASE_URL`

**Free Tier:** 500MB storage, unlimited API requests, 2 projects

### Option B: Neon (Serverless - Free)

1. Go to [neon.tech](https://neon.tech) → Create account
2. Create project → Copy connection string
3. Add `?sslmode=require` to the URL

**Free Tier:** 0.5GB storage, auto-suspend after 5 min inactivity

---

## Step 2: Deploy Backend Server

### Option A: Railway (Easiest)

1. Go to [railway.app](https://railway.app) → Connect GitHub
2. Create new project → **Deploy from GitHub repo**
3. Select your repository, set **Root Directory** to `server`
4. Add environment variable:
   - `DATABASE_URL` = your Supabase/Neon connection string
5. Railway auto-detects Node.js and deploys
6. Get your deployed URL (e.g., `https://your-app.up.railway.app`)

**Cost:** $5 free credit/month → ~FREE for small usage

### Option B: Render (Free tier)

1. Go to [render.com](https://render.com) → Create account
2. New → **Web Service** → Connect GitHub repo
3. Settings:
   - Root Directory: `server`
   - Build Command: `npm install && npm run db:generate`
   - Start Command: `npm start`
4. Add environment variable: `DATABASE_URL`
5. Deploy and get your URL

**Cost:** FREE (spins down after 15 min inactivity, ~30s cold start)

### Option C: Fly.io (Good performance)

```bash
# Install flyctl CLI
cd server
fly launch
fly secrets set DATABASE_URL="your-connection-string"
fly deploy
```

**Cost:** FREE for 3 shared VMs

---

## Step 3: Update Extension for Production

### 3.1 Update API URL

Edit `extension/background.js`:

```javascript
// Change from localhost to your deployed server
const API_BASE = 'https://your-server.up.railway.app/api';
```

### 3.2 Update manifest.json

Edit `extension/manifest.json`:

```json
{
  "name": "YouTube Comments Unlocker",
  "version": "1.0.0",
  "description": "Enable community comments on YouTube videos with disabled comments",
  "host_permissions": [
    "https://your-server.up.railway.app/*"
  ]
}
```

---

## Step 4: Publish to Chrome Web Store

### 4.1 Prepare Assets

Create these images:
- **Icon**: 128x128 PNG (already have as icon128.png)
- **Screenshots**: 1280x800 or 640x400 PNG (at least 1)
- **Promo tile**: 440x280 PNG (optional but recommended)

### 4.2 Create ZIP Package

```bash
cd extension
# Create ZIP with all extension files (exclude .git, node_modules)
# Include: manifest.json, popup.html, popup.js, popup.css, 
#          content.js, styles.css, background.js, icons/
```

### 4.3 Submit to Chrome Web Store

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay **$5 one-time registration fee**
3. Click **New Item** → Upload ZIP
4. Fill in details:
   - Description
   - Category: Social & Communication
   - Screenshots
   - Privacy policy URL (required)
5. Submit for review (takes 1-3 days)

---

## Cost Summary

| Service | Free Tier | Paid (if exceeded) |
|---------|-----------|-------------------|
| **Chrome Web Store** | $5 one-time | - |
| **Supabase (DB)** | 500MB, 2 projects | $25/mo Pro |
| **Railway (Server)** | $5/mo credit | $0.01/hr after |
| **Render (Server)** | 750 hrs/mo | $7/mo starter |

### Estimated Monthly Cost

| Usage Level | Monthly Cost |
|-------------|--------------|
| **Low** (< 1000 users) | **$0** (free tiers) |
| **Medium** (1000-10000 users) | **$5-15/mo** |
| **High** (10000+ users) | **$25-50/mo** |

---

## Production Checklist

- [ ] Deploy PostgreSQL database
- [ ] Run `npm run db:push` to create tables
- [ ] Deploy backend server
- [ ] Test API endpoints work
- [ ] Update `API_BASE` in extension
- [ ] Update `host_permissions` in manifest
- [ ] Create extension ZIP package
- [ ] Create screenshots and promo images
- [ ] Write privacy policy
- [ ] Pay Chrome Web Store fee
- [ ] Submit extension for review

---

## Monitoring & Maintenance

### Server Logs
- **Railway**: Dashboard → Deployments → View Logs
- **Render**: Dashboard → Your Service → Logs

### Database Management
- Use **Prisma Studio** locally: `npm run db:studio`
- Or use **Supabase Dashboard** for direct DB access

### Updating the Extension
1. Make changes locally
2. Increment version in `manifest.json`
3. Create new ZIP
4. Upload to Chrome Developer Dashboard
5. Submit for review
