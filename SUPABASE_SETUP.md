# Supabase Database Setup Guide

Quick guide for setting up StudyQuest database on Supabase.

---

## Step 1: Create Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up with GitHub
3. Click **"New Project"**
4. Settings:
   - Name: `studyquest`
   - Database Password: Create secure password (SAVE THIS!)
   - Region: **Singapore** (ap-southeast-1) - closest to HK
5. Wait 1-2 minutes for provisioning

---

## Step 2: Run Migrations

1. In project dashboard → **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `backend/schema_combined.sql`
4. Paste into editor
5. Click **"Run"**
6. Wait for "Success. No rows returned"

---

## Step 3: Get Connection String

1. Settings → Database → **Connection string**
2. Select **URI** tab
3. Select **Node.js** format
4. Copy the connection string
5. It looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxxx.supabase.co:5432/postgres
   ```

---

## Step 4: Add to Render Environment

In your Render dashboard → Web Service → Environment:

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres?sslmode=require
```

**Important**: Add `?sslmode=require` at the end!

---

## Step 5: Verify Connection

```bash
# Test from local
curl https://your-api.onrender.com/api/health

# Should return:
{
  "status": "Server is running!",
  "database": {
    "status": "connected",
    "message": "Connected to PostgreSQL at 2026-..."
  }
}
```

---

## Database Management

### View Tables
Dashboard → Table Editor → See all your tables

### Run Queries
Dashboard → SQL Editor → Write custom SQL

### Check Usage
Dashboard → Project Settings → Usage
- Free tier: 500MB storage, 2GB/day bandwidth

### Reset Database
**DANGER**: This deletes ALL data!
1. Dashboard → SQL Editor
2. Run: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
3. Re-run schema_combined.sql

---

## Connection Pooling (Recommended for production)

For high traffic, use connection pooler:

1. Settings → Database → **Connection pooling**
2. Copy PgBouncer connection string
3. Use format:
   ```
   postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:6543/postgres?pgbouncer=true
   ```

This helps with connection limits (free tier: 60 concurrent).

---

## Backup (Manual)

Free tier doesn't have auto-backups. Manual backup:

```bash
# Install supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Dump database
supabase db dump -f backup.sql
```

Or use SQL Editor → Export data.

---

## Common Issues

### "Connection refused"
- Check if using correct port: `5432` (not 6543 unless pooling)
- Verify password is correct (no special characters issues)
- Ensure `?sslmode=require` is added

### "Too many connections"
- Use connection pooling (port 6543)
- Or upgrade to Pro ($25/month)

### "Database paused"
- Free tier pauses after 7 days inactivity
- Simply open dashboard → "Resume project"

---

**Supabase Setup Complete!** 🐘
