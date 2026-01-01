# StudyQuest (FYP_GP20) — Timetable (Week-by-Week)

> Tech: React (CRA + Tailwind) + Node/Express + Supabase Postgres + JWT Auth  
> Repos/Folders: `backend/`, `frontend/`, `Doc/`

---

## Week 1 — Project Setup & Planning ✅
- ✅ Define project scope + feature list (StudyQuest)
- ✅ Setup repo structure (backend, frontend, docs)
- ✅ Setup Supabase project + database
- ✅ Setup initial documentation (`Doc/idea.md`, report template)

**Output:** Working project structure + clear scope

---

## Week 2 — Database Design & Migration ✅
- ✅ Design tables (students, study_sessions, achievements, leaderboard, student_achievements, etc.)
- ✅ Create initial schema migration  
  - ✅ `backend/migrations/001_initial_schema.sql`
- ✅ Setup DB connection utility  
  - ✅ `backend/db/connection.js`
- ✅ Test DB connection from backend (successful)

**Output:** Supabase Postgres connected + schema created

---

## Week 3 — Authentication System ✅
- ✅ Implement auth routes  
  - ✅ `backend/routes/auth.js`
- ✅ Register user with hashed password
- ✅ Login user + JWT token generation
- ✅ Auth middleware (protect routes)  
  - ✅ `backend/middleware/auth.js`
- ✅ Test with curl:
  - ✅ `/api/auth/health`
  - ✅ `/api/auth/register`
  - ✅ `/api/auth/login`
  - ✅ `/api/auth/profile` (protected)

**Output:** Working authentication + protected profile endpoint

---

## Week 4 — Study Session API ✅
- ✅ Implement study session routes  
  - ✅ `backend/routes/sessions.js`
- ✅ Features completed:
  - ✅ Start Session (creates UUID)
  - ✅ Get Active Session
  - ✅ End Session
  - ✅ Get Statistics
  - ✅ Get History
- ✅ Confirm database write/read works

**Output:** Complete Study Session API (core backend feature)

---

## Week 5 — Dashboard + Frontend Integration ✅
- ✅ Setup frontend (CRA + Tailwind)
- ✅ Build API helper + token handling  
  - ✅ `frontend/src/utils/api.js`
  - ✅ `frontend/src/utils/auth.js`
- ✅ Build UI:
  - ✅ Login + Register (`components/auth`)
  - ✅ Dashboard UI (`components/dashboard/Dashboard.jsx`)
  - ✅ Shared UI components (`components/shared/*`)
- ✅ Frontend successfully connects to backend + DB data

**Output:** End-to-end flow working (frontend ↔ backend ↔ Supabase)

---

## Week 6 — Gamification + Achievements ✅
- ✅ Implement gamification helper  
  - ✅ `backend/utils/gamification.js`
- ✅ Achievements API  
  - ✅ `backend/routes/achievements.js`
- ✅ Frontend achievements UI:
  - ✅ `Achievements.jsx`
  - ✅ `AchievementCard.jsx`
  - ✅ Achievement popup notification (`AchievementNotification.jsx`)

**Output:** Achievements feature available + popup feedback

---

## Week 7 — Leaderboard + My Rank ✅
- ✅ Leaderboard API  
  - ✅ `backend/routes/leaderboard.js`
- ✅ Student routes as needed  
  - ✅ `backend/routes/student.js`
- ✅ Frontend shows leaderboard + “My Rank” (basic)

**Output:** Competitive element working (leaderboard + rank)

---

# Remaining Weeks (Planned Work / Improvements)

## Week 8 — API Hardening & Consistency ⬜
- ⬜ Standardize API responses across all routes (`success/message/data/error`)
- ⬜ Add request validation (auth + sessions) to prevent invalid payloads
- ⬜ Improve error handling (central Express error middleware)
- ⬜ Ensure `/register` messaging and behavior are consistent everywhere
- ⬜ Add rate limiting for auth routes (basic security)

**Output:** Stable and consistent API (ready for deployment)

---

## Week 9 — Dashboard Upgrade (Analytics) ⬜
- ⬜ Improve dashboard endpoint(s) to return:
  - ⬜ weekly/monthly study minutes
  - ⬜ streaks (current & longest)
  - ⬜ recent sessions list
- ⬜ Add charts (weekly trend) and better empty states in frontend

**Output:** Dashboard v2 with meaningful analytics (demo-ready)

---

## Week 10 — Achievements Reliability (Rule Engine) ⬜
- ⬜ Evaluate achievements automatically after `End Session`
- ⬜ Ensure idempotent unlock (no duplicates)
- ⬜ Expand achievements list (5–10 total)
- ⬜ Improve achievements page (locked/unlocked UI)

**Output:** Solid achievements system that always works

---

## Week 11 — UI Polish + UX Flow ⬜
- ⬜ Improve navigation flow (Navbar routes, protected routes)
- ⬜ Add session history page filters (date range)
- ⬜ Loading states, error toasts, empty states across pages

**Output:** Smooth user experience end-to-end

---

## Week 12 — Testing + Deployment + Report Materials ⬜
- ⬜ Add basic backend tests (auth + sessions)
- ⬜ Build frontend production bundle + fix warnings
- ⬜ Deploy:
  - ⬜ Backend (Render/Railway)
  - ⬜ Frontend (Vercel)
  - ⬜ Supabase env + security check
- ⬜ Prepare demo script + screenshots
- ⬜ Update final report content + diagrams

**Output:** Deployed system + final presentation/report ready