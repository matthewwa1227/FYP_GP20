# StudyQuest Deployment Guide - Railway

**MISSION 60: Deploy StudyQuest to Production**

This guide covers deploying the full StudyQuest application to Railway (PaaS).

---

## 📋 Prerequisites

- Railway account: [railway.app](https://railway.app)
- Railway CLI installed: `npm i -g @railway/cli`
- GitHub repository with your code
- Kimi API key

---

## 🚀 Quick Start

### 1. Login to Railway

```bash
railway login
```

### 2. Initialize Project

From project root:

```bash
# Link to Railway project (creates new if doesn't exist)
railway init

# Or link to existing project
railway link
```

### 3. Add PostgreSQL Database

```bash
# Via CLI
railway add --database postgres

# Or via Dashboard: New → Database → PostgreSQL
```

### 4. Deploy Backend

```bash
cd backend
railway up
```

### 5. Deploy Frontend

```bash
cd frontend
railway up
```

---

## ⚙️ Environment Variables

### Backend Variables (Railway Dashboard)

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Production mode |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Auto-linked to Railway Postgres |
| `KIMI_API_KEY` | `sk-xxx` | Your Kimi API key |
| `JWT_SECRET` | `your-secret-key` | Random 32+ character string |
| `FRONTEND_URL` | `https://xxx.up.railway.app` | Frontend Railway URL |
| `PORT` | `3000` | Auto-set by Railway |

### Frontend Variables (Railway Dashboard)

| Variable | Value | Description |
|----------|-------|-------------|
| `REACT_APP_API_URL` | `https://xxx.up.railway.app/api` | Backend API URL |
| `REACT_APP_ENV` | `production` | Production mode |
| `NODE_ENV` | `production` | Production build |

---

## 🔧 Deployment Configuration

### Backend (`/backend/railway.json`)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Frontend (`/frontend/railway.json`)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npx serve -s build -l $PORT",
    "healthcheckPath": "/",
    "healthcheckTimeout": 60
  }
}
```

---

## 🗄️ Database Migration

### Method 1: Railway CLI

```bash
cd backend

# Run migrations
railway run npm run migrate

# Or connect to DB shell
railway connect postgres
```

### Method 2: Local Migration with Remote DB

```bash
cd backend

# Set DATABASE_URL to Railway DB, run locally
DATABASE_URL=postgresql://... npm run migrate
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] **Health Check**: `GET https://backend-url.up.railway.app/api/health`
  ```json
  {
    "status": "Server is running!",
    "database": { "status": "connected" }
  }
  ```

- [ ] **Frontend Loads**: `https://frontend-url.up.railway.app`

- [ ] **Login Works**: Can register/login as student

- [ ] **Database Persisting**: Create task → refresh → task remains

- [ ] **AI Generation**: Generate exercises works (Kimi API)

- [ ] **File Upload**: Document upload/analysis works

- [ ] **No CORS Errors**: Check browser console

---

## 🐛 Troubleshooting

### "Build Failed" Errors

```bash
# Check Node version
railway logs

# Add to backend/package.json:
"engines": { "node": ">=18.0.0" }
```

### "Database Connection Failed"

```bash
# Verify DATABASE_URL format
postgresql://user:pass@host:5432/database?sslmode=require

# Test connection
railway connect postgres
```

### CORS Errors

1. Check `FRONTEND_URL` env var is set correctly
2. Verify Railway domain matches pattern `*.up.railway.app`
3. Redeploy backend after changing env vars

### 502 Bad Gateway

- Ensure server listens on `process.env.PORT` (not hardcoded)
- Health check endpoint must return 200 OK

### API Calls Failing

```javascript
// Check frontend env var is set
REACT_APP_API_URL=https://your-backend.up.railway.app/api

// Rebuild frontend after env change
railway up
```

---

## 🔗 Useful Commands

```bash
# View logs
railway logs

# Follow logs in real-time
railway logs -f

# Run command in deployment
railway run npm run migrate

# Open dashboard
railway open

# Status
railway status

# Disconnect/reconnect
railway disconnect
railway link
```

---

## 💰 Cost Estimate

| Resource | Cost |
|----------|------|
| Railway (Hobby Plan) | $5/month credit |
| PostgreSQL | Included in credit |
| Bandwidth | 100GB free |
| **Total** | **~$0-5/month** |

Free for development/light usage.

---

## 🌐 Custom Domain (Optional)

1. Railway Dashboard → Service → Settings → Domains
2. Click "Generate Domain" or "Custom Domain"
3. Add DNS records as instructed
4. Update `FRONTEND_URL` and `CUSTOM_DOMAIN` env vars
5. Redeploy

---

## 🔄 Auto-Deploy Setup

1. GitHub → Repository → Settings → Webhooks
2. Railway auto-creates webhook on `railway init`
3. Push to main branch → auto-deploys

```bash
# Standard workflow
git add .
git commit -m "Update feature"
git push origin main
# Railway auto-deploys!
```

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `backend/railway.json` | Backend deployment config |
| `frontend/railway.json` | Frontend deployment config |
| `backend/server.js` | Health check, CORS setup |
| `frontend/src/utils/api.js` | API URL configuration |
| `DEPLOYMENT.md` | This guide |

---

## 🆘 Support

- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- StudyQuest Issues: Check project GitHub

---

**MISSION 60: DEPLOYMENT READY** 🚀
