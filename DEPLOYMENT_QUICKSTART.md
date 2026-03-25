# StudyQuest Deployment Quick Start

**Choose your deployment path:**

---

## 🆓 Option 1: Completely FREE (Vercel + Render + Supabase)

```bash
# Time: ~5 minutes | Cost: $0/month

# 1. Supabase Database
#    - supabase.com → New Project (Singapore region)
#    - SQL Editor → Run backend/schema_combined.sql
#    - Copy DATABASE_URL from Settings → Database

# 2. Backend (Render)
#    - render.com → New Web Service
#    - Connect GitHub repo
#    - Build: npm install | Start: npm start
#    - Env vars: DATABASE_URL, KIMI_API_KEY, JWT_SECRET
#    - Copy URL: https://xxx.onrender.com

# 3. Frontend (Vercel)  
#    - vercel.com → Import Project
#    - Root: frontend | Framework: Create React App
#    - Env: REACT_APP_API_URL=https://xxx.onrender.com/api
#    - Copy URL: https://xxx.vercel.app

# 4. Update Backend CORS
#    - Render Dashboard → Environment
#    - Add: FRONTEND_URL=https://xxx.vercel.app
```

**Limitation**: Backend sleeps after 15min (30s cold start)

---

## 🚀 Option 2: Always-On FREE (Fly.io + Supabase)

```bash
# Time: ~10 minutes | Cost: $0/month (within $5 credit)

# 1. Install Fly CLI
iwr https://fly.io/install.ps1 -useb | iex  # Windows
curl -L https://fly.io/install.sh | sh       # Mac/Linux

# 2. Deploy Backend
cd backend
fly launch --name studyquest-api --region hkg
fly deploy

# 3. Create Database
fly postgres create --name studyquest-db
fly postgres attach studyquest-db

# 4. Set Secrets
fly secrets set KIMI_API_KEY=xxx JWT_SECRET=yyy

# 5. Deploy Frontend (Vercel same as above)
#    REACT_APP_API_URL=https://studyquest-api.fly.dev/api
```

**Benefit**: 24/7 uptime, Hong Kong region, no cold starts!

---

## 🔧 One-Liner Tests

```bash
# Health check
curl https://YOUR-API.com/api/health

# Database check  
curl https://YOUR-API.com/api/db/test

# Full API list
curl https://YOUR-API.com/api
```

---

## 📋 Environment Variables Template

### Backend
```env
NODE_ENV=production
PORT=10000                    # Render uses 10000, Fly uses 8080
DATABASE_URL=postgresql://...
KIMI_API_KEY=sk-xxx
JWT_SECRET=random-string-32+
FRONTEND_URL=https://xxx.vercel.app
```

### Frontend
```env
REACT_APP_API_URL=https://xxx.onrender.com/api
REACT_APP_ENV=production
```

---

## 📁 Key Files Created

```
backend/
├── Dockerfile              # Fly.io
├── fly.toml               # Fly.io (generated)
├── render.yaml            # Render blueprint
├── render.json            # Render config
├── railway.json           # Railway (if needed)
├── schema_combined.sql    # Supabase schema
└── scripts/
    └── migrate.js         # DB migrations

frontend/
├── vercel.json            # Vercel SPA routing
└── ...

root/
├── DEPLOYMENT.md          # Railway guide
├── DEPLOYMENT_FREE.md     # Vercel+Render+Supabase
├── DEPLOYMENT_FLYIO.md    # Fly.io guide
├── SUPABASE_SETUP.md      # Database setup
└── DEPLOYMENT_QUICKSTART.md  # This file
```

---

## 🎯 Recommended Path

1. **Start with FREE option** (Vercel + Render + Supabase)
2. **Test everything works**
3. **If sleeping is annoying** → Migrate backend to Fly.io
4. **For production** → Consider paid tier ($7-25/month)

---

**Deploy Now!** 🚀
