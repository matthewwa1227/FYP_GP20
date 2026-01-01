# StudyQuest — Updated Timetable (2025/2026)

**Programme:** Higher Diploma in Software Engineering – Final Year Project (2025/2026)  
**App:** StudyQuest (PWA)  
**Stack:** React 18 (CRA) + Tailwind + Node/Express + PostgreSQL (Supabase) + JWT  
**Hosting Target:** Vercel (Frontend) + Railway (Backend)  

**Legend:** ✅ Done | 🟦 In Progress | ⬜ Planned

---

## Phase 1 — Foundation (Weeks 1–16)
Focus: Student utility + core system + basic parent loop  
Milestone: **Interim Report at Week 8**

---

### Week 1 — Project Setup & Planning ✅
- ✅ Confirm scope, MVP + Phase 2 features
- ✅ Repo setup (`backend/`, `frontend/`, `Doc/`)
- ✅ Supabase project created + env setup
- ✅ Initial documentation and proposal draft

**Deliverable:** Ready baseline project + plan

---

### Week 2 — Database Schema Design & Migration ✅
- ✅ ERD + table design
- ✅ Initial schema migration created and applied  
  - `backend/migrations/001_initial_schema.sql`
- ✅ DB connection module  
  - `backend/db/connection.js`

**Deliverable:** Working Postgres schema + stable backend DB access

---

### Week 3 — Authentication (Student) + JWT Security ✅
- ✅ Auth API (register/login/profile)
- ✅ Password hashing + JWT issuing
- ✅ Auth middleware  
  - `backend/middleware/auth.js`

**Deliverable:** Secure authentication + protected routes

---

### Week 4 — Study Timer Backend (Session Logging API) ✅
- ✅ Study sessions API implemented  
  - start / active / end / history / stats
- ✅ Store subject + timestamps in DB

**Deliverable:** Study session logging complete

---

### Week 5 — Frontend Core + API Integration ✅
- ✅ React + Tailwind UI foundation
- ✅ Login/Register screens
- ✅ Token handling + API helper (`frontend/src/utils/*`)
- ✅ Study timer UI integrated with backend

**Deliverable:** End-to-end student flow (login → study → save session)

---

### Week 6 — Gamification Engine + Basic Badges ✅
- ✅ Points rule: 1 minute = 1 point
- ✅ Basic achievements/badges + notifications
- ✅ Achievements API + frontend achievements page

**Deliverable:** Gamification loop (points + achievements) working

---

### Week 7 — Leaderboard (MVP) ✅
- ✅ Global leaderboard API + frontend page
- ✅ “My rank” display

**Deliverable:** Competitive feature (global leaderboard)

---

### Week 8 — Interim Report + Stabilization (Milestone) ⬜
- ⬜ Consolidate documentation for Interim Report:
  - architecture diagram (FE/BE/DB)
  - ERD diagram
  - API list + screenshots of main features
- ⬜ Code cleanup + error handling standardization (API response format)
- ⬜ Add basic validation for auth and sessions

**Deliverable:** **Interim Report** + stable demo build

---

### Week 9 — Parent Module Foundations: Roles + Parent Registration ⬜
- ⬜ Extend auth to support roles: `student` / `parent`
- ⬜ Update DB schema for roles + parent profile fields (if needed)
- ⬜ Separate parent routes (protected)
- ⬜ Frontend: parent register/login and parent navigation

**Deliverable:** Parent account can log in and reach parent area

---

### Week 10 — Parent-Child Linking (Unique Code) ⬜
- ⬜ Student generates a unique linking code (rotating or one-time)
- ⬜ Parent enters code to link to student
- ⬜ DB: parent-child relationship table + constraints
- ⬜ Frontend: student “Link Code” page + parent “Enter Code” page

**Deliverable:** Parent-child linking works securely

---

### Week 11 — Parent Progress Dashboard (Read-Only) ⬜
- ⬜ Parent dashboard endpoints:
  - total study time (daily/weekly)
  - subject breakdown
  - recent sessions summary
- ⬜ Frontend: parent dashboard charts/cards

**Deliverable:** Parent gains visibility (core problem statement solved)

---

### Week 12 — Goal Setting (Parent → Student) ⬜
- ⬜ Parent creates weekly time-based goal (e.g., 300 minutes/week)
- ⬜ Student dashboard shows goal progress bar
- ⬜ DB: goals table + status fields

**Deliverable:** Parent can set goals; student sees progress

---

### Week 13 — Student Dashboard v2 (Analytics) ⬜
- ⬜ Backend analytics endpoints:
  - weekly trend (last 7 days)
  - monthly trend (last 30 days)
  - streaks (current + longest)
  - subject breakdown
- ⬜ Frontend: improved dashboard visuals + empty states

**Deliverable:** Student dashboard becomes data-driven and meaningful

---

### Week 14 — System Hardening & Security Review ⬜
- ⬜ Centralized error middleware
- ⬜ Rate limiting for auth + AI routes (placeholder for later)
- ⬜ Validation rules across endpoints
- ⬜ Ensure parent can access only linked child data (authorization checks)

**Deliverable:** Safer backend suitable for social features

---

### Week 15 — PWA Baseline (Installable) ⬜
- ⬜ Enable service worker (PWA)
- ⬜ Confirm installable on mobile
- ⬜ Add offline indicator UI (no syncing yet)

**Deliverable:** Installable PWA baseline

---

### Week 16 — Phase 1 Demo Polish + Buffer ⬜
- ⬜ Bug fixing, UI consistency, responsive testing
- ⬜ Prepare Phase 1 demo script + screenshots

**Deliverable:** Phase 1 complete + polished demo

---

---

## Phase 2 — Expansion (Weeks 17–24)
Focus: Social + privacy + AI + engagement

---

### Week 17 — Privacy Tiers (Private / Friends / Public) ⬜
- ⬜ DB: add privacy setting per student
- ⬜ Enforce privacy in leaderboard queries
- ⬜ Frontend settings page for privacy selection

**Deliverable:** Privacy tiers implemented and enforced

---

### Week 18 — Friends System (Requests + Accept) ⬜
- ⬜ Friend request endpoints (send/accept/reject/list)
- ⬜ Frontend friends page (requests, list)
- ⬜ Authorization checks (no data leaks)

**Deliverable:** Friends network MVP

---

### Week 19 — Friends Leaderboard + Group Competition MVP ⬜
- ⬜ Friends-only leaderboard endpoint
- ⬜ UI tab: global / friends
- ⬜ Optional: lightweight “group goal” (if time)

**Deliverable:** Social competition loop works

---

### Week 20 — AI Chatbot (Groq) ⬜
- ⬜ Backend `/api/ai/chat` using Groq (Llama-3)
- ⬜ Prompt includes user streak + weak subjects + goals (personalization)
- ⬜ Frontend chatbot UI (panel/page)
- ⬜ Add AI rate limit + timeouts

**Deliverable:** AI Study Buddy working with personalization

---

### Week 21 — AI Schedule Optimizer (DeepSeek) ⬜
- ⬜ Backend `/api/ai/schedule` using DeepSeek Reasoning model
- ⬜ Generate weekly plan based on session history + goals + availability
- ⬜ Frontend schedule view page (weekly plan display)

**Deliverable:** One-click personalized schedule generation

---

### Week 22 — Reward Marketplace (Parent Creates Rewards) ⬜
- ⬜ DB: rewards table (name, cost, availability, created_by_parent)
- ⬜ Parent CRUD endpoints for rewards
- ⬜ Student can view available rewards

**Deliverable:** Reward catalogue created by parent

---

### Week 23 — Reward Redemption + Parent Verification ⬜
- ⬜ Student redemption request (spend points)
- ⬜ Parent approves/denies redemption
- ⬜ Update points balance and redemption status
- ⬜ Frontend: redemption flow and status UI

**Deliverable:** Verified reward loop (engagement + parent collaboration)

---

### Week 24 — Phase 2 Integration + Buffer ⬜
- ⬜ End-to-end testing of social + AI + rewards together
- ⬜ Fix edge cases, improve performance

**Deliverable:** Phase 2 complete + stable demo

---

---

## Phase 3 — Refinement (Weeks 25–30)
Focus: smart analytics, offline sync, QA, deployment, final report

---

### Week 25 — “Smart Analytics” Insights (No External AI) ⬜
- ⬜ SQL-based peak productivity hours
- ⬜ Subject neglect detection + recommendations
- ⬜ Streak risk prediction logic (time-of-day rules)

**Deliverable:** Insight cards generated without AI cost

---

### Week 26 — Offline Sync (PWA) ⬜
- ⬜ Store offline sessions locally (queue)
- ⬜ Sync when online (conflict-safe)
- ⬜ UX: offline banner + sync status indicator

**Deliverable:** Robust offline experience (key PWA requirement)

---

### Week 27 — QA: Testing + Security Audit ⬜
- ⬜ Unit tests for key endpoints (auth, sessions, linking, rewards)
- ⬜ Privacy verification tests (private/friends/public)
- ⬜ Basic OWASP checks (rate limits, auth, access control)

**Deliverable:** Verified security + regression protection

---

### Week 28 — UI/UX Polish + Performance ⬜
- ⬜ Mobile-first review (iOS/Android)
- ⬜ Accessibility quick pass (contrast, labels)
- ⬜ Performance: reduce dashboard load time (<2s goal)

**Deliverable:** Final UI polish and performance readiness

---

### Week 29 — Deployment (Vercel + Railway) ⬜
- ⬜ Deploy backend to Railway with env vars
- ⬜ Deploy frontend to Vercel
- ⬜ Production config: CORS, HTTPS, API base URLs
- ⬜ Smoke testing on deployed URLs

**Deliverable:** Publicly accessible final system

---

### Week 30 — Final Report + Final Presentation (Milestone) ⬜
- ⬜ Final report:
  - architecture, ERD, implementation, testing, evaluation metrics
- ⬜ Final presentation slides + demo script
- ⬜ Final bug fixes + submission packaging

**Deliverable:** **Final Report + Final Demo Submission**

---

## Evaluation Metrics Checklist (from Project Plan)
- ⬜ Dashboard loads in < 2 seconds
- ⬜ Chatbot replies in < 3 seconds (rate-limited + cached where possible)
- ⬜ Uptime / stability during testing
- ⬜ Engagement target: average streak > 3 days (test cohort)
- ⬜ Schedule optimizer generates valid time slots from history