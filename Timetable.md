# StudyQuest (FYP_GP20) — Timetable / Progress Plan

> Repo structure confirmed:
> - `backend/` (Express + Supabase Postgres)
> - `frontend/` (Create React App + Tailwind)
> Key routes: `routes/auth.js, sessions.js, dashboard.js, achievements.js, leaderboard.js, student.js`
> Key UI: `Dashboard`, `StudyTimer`, `Achievements`, `Login`, `Register`, shared components.

---

## ✅ Completed (Current Progress)
### Backend (Express + Supabase)
- [x] Project structure created (`server.js`, `db/connection.js`, `middleware/auth.js`)
- [x] Supabase Postgres connection working (tested)
- [x] Initial DB schema migration created (`migrations/001_initial_schema.sql`)
- [x] Authentication system
  - [x] Register user + hashed password
  - [x] Login returns JWT token
  - [x] Auth middleware protects routes (Bearer token)
  - [x] Profile endpoint works with valid token
- [x] Study Session API (`routes/sessions.js`)
  - [x] Start session (returns session UUID)
  - [x] Get active session
  - [x] End session
  - [x] Get statistics
  - [x] Get history
- [x] Dashboard API (`routes/dashboard.js`) basic working
- [x] Achievements API (`routes/achievements.js`) basic working
- [x] Leaderboard API (`routes/leaderboard.js`) basic working
- [x] Gamification helper exists (`utils/gamification.js`)

### Frontend (React + Tailwind)
- [x] Project bootstrapped (CRA) + Tailwind configured
- [x] Auth pages completed
  - [x] `Login.jsx`
  - [x] `Register.jsx`
  - [x] Token handling (`src/utils/auth.js`)
- [x] API connector created (`src/utils/api.js`)
- [x] Main pages/components completed (basic)
  - [x] Dashboard (`components/dashboard/Dashboard.jsx`)
  - [x] Study Timer (`components/StudyTimer/StudyTimer.jsx`)
  - [x] Achievements (`components/Achievements/Achievements.jsx`)
  - [x] Achievement popup notification (`AchievementNotification.jsx`)
- [x] Shared UI components created (`Navbar`, `PixelButton`, `PixelCard`, `StatCard`, `ProgressBar`)

---

## 🟡 In Progress (Next Improvements)
### Week 1 — Hardening + Documentation (Backend + Frontend)
- [ ] Standardize API response format across all routes (same `{success,message,data}` pattern)
- [ ] Add request validation for auth + sessions (prevent bad inputs)
- [ ] Ensure `/auth/register` returns correct “implemented” message + consistent behavior
- [ ] Add better error handling middleware (Express)
- [ ] Update `README.md` (root) to explain:
  - [ ] how to run backend
  - [ ] how to run frontend
  - [ ] required `.env` variables
- [ ] Add simple API test checklist in `Doc/idea.md` or `login.md`

**Deliverable:** Clean API contract + updated docs + stable dev experience

---

## ⬜ Planned Work (To Finish FYP Features)
### Week 2 — Dashboard Upgrade (Real Analytics)
- [ ] Improve dashboard API to return:
  - [ ] weekly/monthly study minutes
  - [ ] streak data
  - [ ] recent sessions list
- [ ] Add charts to Dashboard (progress trend, minutes)
- [ ] Add proper empty states (new users)

**Deliverable:** Dashboard v2 with meaningful analytics

---

### Week 3 — Achievements System (Reliable + Automatic)
- [ ] Implement achievement rule checking after `End Session`
- [ ] Ensure achievements are idempotent (cannot unlock same achievement twice)
- [ ] Expand achievements list (5–10 achievements)
- [ ] Frontend: show locked/unlocked clearly + better achievement popup UX

**Deliverable:** Achievements v1 complete (demo-ready)

---

### Week 4 — Leaderboard + My Rank (Polish + Performance)
- [ ] Confirm ranking logic (points/time) and make consistent
- [ ] Add “My Rank” endpoint if needed (or compute efficiently)
- [ ] Add pagination / limit top N leaderboard
- [ ] Frontend leaderboard page/section polish

**Deliverable:** Smooth leaderboard + accurate “My Rank”

---

### Week 5 — Student Profile + Settings (MVP)
- [ ] Profile page (view/edit username/avatar/basic info)
- [ ] Password change / logout flow
- [ ] Session history page filters (date range)

**Deliverable:** Complete student account experience

---

### Week 6 — Finalization (Testing + Deployment + Report Support)
- [ ] Basic backend tests (at least auth + sessions routes)
- [ ] Frontend build check + fix warnings
- [ ] Deployment plan:
  - [ ] backend deploy (Render/Railway)
  - [ ] frontend deploy (Vercel)
  - [ ] Supabase env + security check
- [ ] Prepare demo script + screenshots
- [ ] Update report content based on finished system

**Deliverable:** Production-ready demo + submission materials

---

## Milestone Summary
- **Milestone A:** Auth + DB + sessions API ✅
- **Milestone B:** Dashboard + achievements + leaderboard basic ✅
- **Milestone C:** Hardening + analytics + polish ⬜
- **Milestone D:** Deployment + final report/demo ⬜