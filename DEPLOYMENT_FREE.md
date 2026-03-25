# StudyQuest FREE Deployment Guide

**MISSION 61: Deploy to Vercel + Render + Supabase (Zero Cost)**

This guide covers deploying StudyQuest using completely FREE services.

---

## 💰 Cost: $0/month

| Service | Purpose | Limit |
|---------|---------|-------|
| **Vercel** | Frontend (React) | Unlimited bandwidth |
| **Render** | Backend (Node.js) | 15min sleep, 512MB RAM |
| **Supabase** | PostgreSQL | 500MB storage |

---

## 🚀 Quick Deploy (5 minutes)

### Step 1: Supabase Database (2 min)

1. Go to [supabase.com](https://supabase.com) → Sign up (GitHub login)
2. Click **"New Project"**
3. Name: `studyquest`
4. Region: **Singapore** (closest to Hong Kong)
5. Password: Create secure password
6. Click **"Create new project"**

7. Once created, go to **SQL Editor** (left sidebar)
8. Click **"New query"**
9. Copy contents of `backend/schema_combined.sql`
10. Paste → Click **"Run"**

11. Get connection string:
    - Settings → Database → Connection string
    - Copy **URI** tab → **Node.js** format
    - Looks like: `postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres`

---

### Step 2: Backend on Render (2 min)

1. Go to [render.com](https://render.com) → Sign up (GitHub)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repo
4. Render will detect `render.yaml` and show:
   - Service: `studyquest-api`
   - Database: `studyquest-db`

5. **Important**: Use **"Web Service"** instead if you want Supabase:
   - Click **"New +"** → **"Web Service"**
   - Connect repo
   - Name: `studyquest-api`
   - Region: **Singapore**
   - Branch: `main`
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: **Free**

6. Add Environment Variables:
   ```
   NODE_ENV=production
   DATABASE_URL=your_supabase_connection_string
   KIMI_API_KEY=your_kimi_key
   JWT_SECRET=any_random_string_32_chars
   FRONTEND_URL=leave_blank_for_now
   ```

7. Click **"Create Web Service"**

8. Wait for deploy (2-3 min)
9. Copy URL: `https://studyquest-api.onrender.com`

---

### Step 3: Frontend on Vercel (1 min)

1. Go to [vercel.com](https://vercel.com) → Sign up (GitHub)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repo
4. Configure:
   - Framework: **Create React App**
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `build`

5. Add Environment Variable:
   ```
   REACT_APP_API_URL=https://studyquest-api.onrender.com/api
   ```

6. Click **"Deploy"**

7. Copy URL: `https://studyquest.vercel.app`

---

### Step 4: Complete Backend Setup (30 sec)

1. Back in Render dashboard → `studyquest-api` → **Environment**
2. Add: `FRONTEND_URL=https://studyquest.vercel.app`
3. Click **"Save Changes"** → Auto redeploys

---

## ✅ Verification

```bash
# Test backend
curl https://studyquest-api.onrender.com/api/health

# Expected:
{
  "status": "Server is running!",
  "database": { "status": "connected" }
}
```

Visit `https://studyquest.vercel.app` → App should load!

---

## 🔧 Important Notes

### Render Free Tier Limitations
- **Sleeps after 15 minutes** of inactivity
- **First request after sleep takes 30-60 seconds** (cold start)
- 512MB RAM, 0.1 CPU
- 100GB bandwidth/month

**Solution for sleeping**: Use [UptimeRobot](https://uptimerobot.com) (free) to ping your API every 14 minutes.

### Supabase Free Tier
- 500MB database storage
- 2GB bandwidth/day
- 100,000 API calls/day
- Auto-pauses after 7 days inactivity (just resume in dashboard)

---

## 📁 Deployment Files

| File | Platform | Purpose |
|------|----------|---------|
| `frontend/vercel.json` | Vercel | SPA routing, headers |
| `backend/render.yaml` | Render | Blueprint config |
| `backend/render.json` | Render | Service config |
| `backend/schema_combined.sql` | Supabase | Full database schema |

---

## 🐛 Troubleshooting

### "Cannot connect to database"
- Check `DATABASE_URL` format
- Ensure using `?sslmode=require` at end
- Try: `postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres?sslmode=require`

### "CORS error"
- Verify `FRONTEND_URL` matches Vercel URL exactly
- Check includes `https://` and no trailing slash

### "Build failed on Render"
- Check Node version in `package.json` engines
- Check build logs for missing dependencies

### "Build failed on Vercel"
- Verify `REACT_APP_API_URL` is set
- Check Root Directory is `frontend`

---

## 🔄 Redeploy

### Auto-deploy on git push:
```bash
git add .
git commit -m "Update feature"
git push origin main
# Both Render and Vercel auto-deploy!
```

### Manual deploy:
- Render: Click "Manual Deploy" → "Clear build cache & deploy"
- Vercel: Click "Redeploy" in dashboard

---

## 🚀 Alternative: Fly.io (No Sleep!)

If Render sleeping is annoying, use Fly.io ($0-5/month):

```bash
# Install Fly CLI
iwr https://fly.io/install.ps1 -useb | iex

# Login
fly auth login

# Deploy backend
cd backend
fly launch
fly deploy

# Create Postgres
fly postgres create --name studyquest-db
fly postgres attach studyquest-db

# Done! Runs 24/7 with $5 free credit
```

See `DEPLOYMENT_FLYIO.md` for full guide.

---

## 📊 Monitoring (Free)

| Service | Monitoring |
|---------|------------|
| Render | Built-in logs + metrics |
| Vercel | Analytics + Real-time logs |
| Supabase | Database logs + usage |
| UptimeRobot | External uptime checks (free tier) |

---

**MISSION 61: FREE DEPLOYMENT READY** 🎉

Total cost: **$0/month** for development/testing!
