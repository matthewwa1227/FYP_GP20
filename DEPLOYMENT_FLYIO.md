# Fly.io Deployment Guide

**Alternative to Render: 24/7 uptime with $5 free credit**

---

## Why Fly.io?

| Feature | Render Free | Fly.io Free |
|---------|-------------|-------------|
| Uptime | Sleeps after 15min | **24/7** |
| Cold starts | 30-60 seconds | **None** |
| RAM | 512MB | 256MB |
| Credit | $0 | **$5/month** |
| Region | Singapore | **Hong Kong** |

If your app fits in $5/month credit, it's **completely free**.

---

## Installation

### Windows (PowerShell)
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

### macOS/Linux
```bash
curl -L https://fly.io/install.sh | sh
```

### Login
```bash
fly auth login
# Opens browser for signup/login
```

---

## Deploy Backend

### 1. Prepare Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
```

### 2. Create fly.toml

```toml
# backend/fly.toml
app = "studyquest-api"
primary_region = "hkg"  # Hong Kong!

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false  # Keep running 24/7
  auto_start_machines = true
  min_machines_running = 1    # Always have 1 machine

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

### 3. Launch & Deploy

```bash
cd backend

# Launch app (creates fly.toml if not exists)
fly launch

# Answer prompts:
# - App name: studyquest-api
# - Region: Hong Kong (hkg)
# - PostgreSQL: Yes (create new)
# - Redis: No

# Deploy
fly deploy

# Check status
fly status

# View logs
fly logs
```

### 4. Set Secrets

```bash
fly secrets set KIMI_API_KEY=your_key
fly secrets set JWT_SECRET=your_secret
fly secrets set FRONTEND_URL=https://your-vercel-url.vercel.app
```

### 5. Get URL

```bash
fly apps list
# URL: https://studyquest-api.fly.dev
```

---

## Database Options

### Option A: Fly Postgres (Recommended)

```bash
# Create Postgres cluster
fly postgres create --name studyquest-db

# Attach to app (sets DATABASE_URL automatically)
fly postgres attach studyquest-db

# Connect to DB
fly postgres connect -a studyquest-db
```

### Option B: Keep Supabase

```bash
# Use Supabase connection string
fly secrets set DATABASE_URL="postgresql://..."
```

---

## Deploy Frontend (Vercel)

Same as free deployment:

1. Go to [vercel.com](https://vercel.com)
2. Import repo
3. Set `REACT_APP_API_URL=https://studyquest-api.fly.dev/api`
4. Deploy

---

## Cost Estimation

Free tier ($5/month credit):
- 1x shared-cpu-1x @ 256MB: ~$1.94/month
- 3GB storage: ~$0.15/month
- Bandwidth: First 160GB free
- **Total: ~$2/month** (well within free credit!)

If you exceed $5, you pay only for what you use.

---

## Commands Reference

```bash
# Deploy updates
fly deploy

# View logs
fly logs
fly logs -f  # Follow

# SSH into machine
fly ssh console

# Restart app
fly apps restart studyquest-api

# Scale up/down
fly scale count 2  # Run 2 machines

# Check metrics
fly status
fly metrics

# List apps
fly apps list

# Destroy app (careful!)
fly apps destroy studyquest-api
```

---

## Troubleshooting

### "Out of memory"
```toml
# fly.toml - increase memory
[[vm]]
  memory_mb = 512
```

### "Health checks failing"
- Ensure `/api/health` returns 200
- Check `internal_port` matches `PORT` env var

### "Build failed"
```bash
# Clear cache and rebuild
fly deploy --no-cache
```

---

## Comparison: Render vs Fly.io

| | Render Free | Fly.io Free |
|--|-------------|-------------|
| **Cost** | $0 | $0 (within credit) |
| **Sleep** | Yes (15min) | **No** |
| **Cold start** | 30-60s | **0s** |
| **HK Region** | No (Singapore) | **Yes!** |
| **Complexity** | Simple | Medium |
| **Best for** | Prototyping | Production |

**Recommendation**: Start with Render, migrate to Fly.io if you need 24/7 uptime.

---

**Fly.io Deployment Ready!** 🚀
