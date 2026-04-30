# StudyQuest - Agent Context

> Final Year Project (FYP GP20). A gamified study companion web application targeting Hong Kong primary and secondary students (Form P1–S6). The codebase, comments, and documentation are written in English.

---

## 1. Project Overview

StudyQuest is a full-stack web application that turns studying into an RPG-style experience. Students earn XP, level up, maintain streaks, unlock achievements, and battle "Bosses" while using AI-powered tools such as a Study Buddy chatbot, adaptive exercise generators, document-based revision mode, and a schedule optimizer.

The platform supports three user roles:
- **student** – Core gamified learning experience.
- **parent** – Monitor linked children’s study stats and schedules via a dashboard.
- **teacher** – Dedicated dashboard (routes and UI exist; feature set is lightweight).

**Live deployment targets**
- Backend: Render (`render.yaml`), Railway (`railway.json`), or Fly.io (`Dockerfile`).
- Frontend: Vercel (`vercel.json`) or Railway.
- Database: PostgreSQL hosted on Supabase (connection via `DATABASE_URL`).

---

## 2. Repository Structure

```
FYP_GP20/
├── backend/                 # Node.js + Express API
│   ├── server.js            # Entry point
│   ├── db/connection.js     # Supabase Postgres pool with retries & metrics
│   ├── routes/              # Express route modules (one per feature)
│   ├── controllers/         # Business logic (AI, revision)
│   ├── middleware/          # Auth, rate limiting, concurrency guards
│   ├── services/            # Kimi AI service integration
│   ├── utils/               # Gamification engine, logger
│   ├── models/              # Data models (e.g., Task.js)
│   ├── migrations/          # Ordered SQL schema migrations (001–019)
│   ├── scripts/migrate.js   # Migration runner
│   ├── uploads/             # Uploaded exercise/document files
│   └── .env                 # Environment variables (⚠️ contains real secrets)
│
├── frontend/                # Main React 19 SPA (Create React App)
│   ├── src/
│   │   ├── App.js           # React Router definitions
│   │   ├── pages/           # Top-level page wrappers
│   │   ├── components/      # Feature components (auth, dashboard, StudyTimer, …)
│   │   ├── utils/api.js     # Centralised Axios API client
│   │   ├── utils/auth.js    # localStorage auth helpers
│   │   ├── context/         # React contexts (ThemeContext)
│   │   └── hooks/           # Custom hooks (useStudySession)
│   ├── tailwind.config.js   # Pixel-RPG theme (Google Stitch palette)
│   └── build/               # Production build artifacts
│
├── studyquest-app/          # Legacy / mock-up CRA app (minimal, mostly unused)
│
├── Doc/                     # Project docs, reports, PPTs
├── Diagram/                 # Architecture & ERD diagrams
└── AGENTS.md                # This file
```

---

## 3. Technology Stack

| Layer | Technology |
|-------|------------|
| Backend runtime | Node.js ≥ 18 |
| Backend framework | Express 4 |
| Database | PostgreSQL (Supabase) |
| DB driver | `pg` (node-postgres) with connection pooling |
| Auth | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`) |
| AI engine | Kimi K2.5 (Moonshot AI) via `openai` SDK (`baseURL: https://api.moonshot.cn/v1`) |
| Document parsing | `mammoth`, `pdf-parse`, `officeparser`, `cheerio` |
| File uploads | `multer` |
| Frontend | React 19, Create React App 5, React Router 7 |
| Styling | Tailwind CSS 3, Framer Motion, Recharts |
| Icons | `lucide-react` |
| State | React Context + localStorage |

---

## 4. Configuration Files

### Backend
- **`backend/package.json`** – Dependencies and scripts (`start`, `dev`, `migrate`).
- **`backend/.env`** – Required variables:
  - `PORT` (default 5000)
  - `NODE_ENV`
  - `DATABASE_URL` – Supabase Postgres connection string
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `KIMI_API_KEY` – Moonshot AI key
  - `FRONTEND_URL` / `CUSTOM_DOMAIN` – Used in CORS config
- **`backend/render.yaml`** – Render Blueprint (Node web service + free Postgres).
- **`backend/Dockerfile`** – Alpine Node 18 image for Fly.io.
- **`backend/nixpacks.toml`** – Nixpacks build config.

### Frontend
- **`frontend/package.json`** – CRA-based React app.
- **`frontend/tailwind.config.js`** – Extensive custom pixel-RPG theme.
- **`frontend/postcss.config.js`** – Standard Tailwind/Autoprefixer setup.
- **`frontend/.env.production.example`** – Example for `REACT_APP_API_URL`.

---

## 5. Build & Run Commands

### Backend
```bash
cd backend
npm install

# Development (nodemon)
npm run dev

# Production
npm start

# Database migrations
npm run migrate
```

### Frontend
```bash
cd frontend
npm install

# Development server (localhost:3000)
npm start

# Production build
npm run build

# Tests (CRA default, no custom test suite present)
npm test
```

### Environment requirements
- Node.js ≥ 18.
- A running PostgreSQL instance (Supabase recommended).
- `DATABASE_URL` must be set before starting the backend.

---

## 6. Database & Migrations

### Schema overview
The database has evolved through **19 ordered SQL migrations** in `backend/migrations/`.

**Core tables**
- `students` – Users (students, parents, teachers). Stores gamification stats (xp, level, streaks, etc.).
- `study_sessions` – Individual study session records.
- `achievements` / `student_achievements` – Badge system.
- `daily_goals` – Per-day study targets.
- `tasks` – Student task/to-do list.

**StudyQuest Rebuild tables (Phase 1)**
- `projects` – User-created learning paths.
- `chapters` – Learning units within a project.
- `questions` – Mixed-type practice questions (code, fill-blank, MC, etc.).
- `question_attempts` – Every answer try with AI diagnosis.
- `knowledge_artifacts` – Markdown cheat sheets generated on chapter completion (full-text search enabled).
- `boss_battles` / `boss_stage_attempts` – Multi-stage synthesis challenges.
- `artifact_access_logs` – Analytics for artifact references.

### Running migrations
```bash
node backend/scripts/migrate.js
```
The script tracks executed files in a `migrations` table and runs new `.sql` files in alphabetical order inside a transaction.

### Notable DB patterns
- Extensive use of **PostgreSQL triggers** for auto-updating `updated_at`, calculating project progress, and checking chapter completion.
- **Row Level Security (RLS)** policies are defined on rebuild tables (`projects`, `chapters`, etc.) but rely on `current_setting('app.current_user_id')`, which is not actively set by the Express app at this time.
- Connection pooling config is in `backend/db/connection.js` with retry logic for deadlocks and timeouts.

---

## 7. API Architecture

### Entry point
`backend/server.js` bootstraps Express, applies CORS, rate limiting, request timeouts, mounts all routes, and handles graceful shutdown on SIGTERM/SIGINT.

### Route modules (`backend/routes/`)
| Route file | Base path | Purpose |
|------------|-----------|---------|
| `auth.js` | `/api/auth` | Register, login, onboarding, profile |
| `student.js` | `/api/student` | Student profile & stats |
| `sessions.js` | `/api/sessions` | Start/end study sessions |
| `tasks.js` | `/api/tasks` | CRUD for student tasks |
| `achievements.js` | `/api/achievements` | Achievements & checks |
| `leaderboard.js` | `/api/leaderboard` | Global / filtered leaderboards |
| `dashboard.js` | `/api/dashboard` | Dashboard stats aggregation |
| `family.js` | `/api/family` | Parent-child linking, schedule monitoring |
| `ai.js` | `/api/ai` | Study Buddy chat, tips, quick actions |
| `storyquest.js` | `/api/storyquest` | Legacy Story Quest RPG content |
| `schedule.js` | `/api/schedule` | AI schedule generation |
| `revision.js` | `/api/revision` | Document upload & quiz generation |
| `archive.js` | `/api/archive` | Archive Alchemist (document → exercises) |
| `progress.js` | `/api/progress` | Progress dashboard data |
| `rewards.js` | `/api/rewards` | Reward system |
| `teacher.js` | `/api/teacher` | Teacher-facing endpoints |
| `social.js` | `/api/social` | Social hub / friends |
| `scheduleOptimizer.js` | `/api/schedule-optimizer` | Schedule optimization |
| `exercises.js` | `/api/exercises` | Exercise generator & document analysis |
| `studyquest-rebuild.js` | `/api/study` | Legacy rebuild routes |
| `projects.js` | `/api/projects` | Project creation & listing |
| `chapters.js` | `/api/chapters` | Chapter retrieval |
| `attempts.js` | `/api/attempts` | Question attempts |
| `bossBattles.js` | `/api/boss-battles` | Boss battle lifecycle |
| `artifacts.js` | `/api/artifacts` | Knowledge artifact retrieval |

### Authentication
- JWT Bearer tokens. Token payload includes `studentId`, `email`, `username`, `role`, `formLevel`, `ageTier`.
- `middleware/auth.js` exports `authenticateToken` (required) and `optionalAuth` (guest-friendly).
- Tokens are stored in `localStorage` on the frontend and attached to every Axios request via `utils/api.js`.

### Rate limiting (`middleware/concurrencyGuard.js`)
- **General limiter**: 100 requests/minute per IP.
- **User limiter**: 20 requests/minute per authenticated user.
- **Login limiter**: 5 attempts per 15 minutes per IP+email.
- **Session action limiter**: 10 starts/ends per minute.
- In-memory store (suitable for single-instance deploys). Headers `X-RateLimit-*` are returned.

---

## 8. AI Integration (Kimi / Moonshot)

All AI features route through `backend/services/kimiService.js`.

**Key capabilities**
- **Study Buddy chat** – Contextual chat using student stats (level, streak, Hero Power).
- **Story Quest / Newquest** – RPG narrative generation with tier-aware prompts.
- **Exercise Generator** – Generates reading comprehension and subject exercises.
- **Revision Mode** – Upload documents (PDF, Word, images) → AI extracts text → generates quizzes.
- **Archive Alchemist** – Upload documents → AI analyses → generates similar exercises.
- **Boss Battles** – Multi-stage AI-generated challenges with diagnostic feedback.
- **Schedule Generator** – AI-generated study schedules based on preferences.

**Tier system**
Students are bucketed by `formLevel` into age tiers: `P1-P3`, `P4-P6`, `S1-S3`, `S4-S6`. The prompt builder (`buildTierInstructions`) adjusts language complexity, content depth, and local Hong Kong context examples automatically.

**API model**: `kimi-k2.5` (max tokens vary by endpoint; thinking mode is used for some endpoints).

---

## 9. Frontend Architecture

### Routing (`frontend/src/App.js`)
- Uses `BrowserRouter` from React Router 7.
- Role-based protected routes via `<ProtectedRoute allowedRoles={['student','parent','teacher']}>`.
- Smart home redirect (`/`) routes to `/dashboard` (student), `/parent/dashboard` (parent), or `/teacher` (teacher).

### API client (`frontend/src/utils/api.js`)
- Single Axios instance with automatic token injection and 401 auto-logout.
- Organised into domain-specific objects: `authAPI`, `studentAPI`, `sessionAPI`, `familyAPI`, `newquestAPI`, `exerciseAPI`, `revisionAPI`, etc.

### Styling
- **Tailwind CSS** with a heavy custom theme (`tailwind.config.js`).
- Design language: **Pixel RPG / retro gaming** (Google Stitch palette).
- Key colours:
  - Background: `#1a063b`
  - Primary (pink): `#ff4a8d`
  - Accent (cyan): `#00f1fe`
  - Gold: `#e9c400`
- Custom utilities: `pixel-border`, `glass-panel`, `shadow-pixel`, `scrollbar-pixel`, etc.

### Component organisation
- `components/auth/` – Login, Register, ProtectedRoute
- `components/dashboard/` – Course cards, main dashboard
- `components/StudyTimer/` – Boss Arena, Hero HUD, Combat Log (gamified timer)
- `components/AITutor/` – Study Buddy, Revision Mode, Story Quest AI
- `components/Newquest/` – Boss battle project flow
- `components/ArchiveAlchemist/` – Document upload & exercise generation
- `components/Social/` – Friends, Guild, Challenges
- `components/Teacher/` – Teacher dashboard
- `components/parent/` – Parent dashboard & linking

---

## 10. Code Style Guidelines

These conventions are derived from the existing codebase; follow them to keep the code consistent.

### Backend
- Use **CommonJS** (`require` / `module.exports`).
- File-level comments often include `MISSION XX:` markers (e.g., `// MISSION 62: Concurrent Access Fixed`). Continue this pattern when adding major fixes.
- Console logging uses **emoji prefixes** for quick visual scanning:
  - `✅` success / OK
  - `❌` error
  - `⚠️` warning
  - `🔄` retry / dedupe
  - `📊` metrics
  - `🚀` starting an operation
  - `📥` / `📤` receiving / sending data
- All API responses follow the envelope shape:
  ```js
  { success: boolean, message?: string, data?: any, error?: string, code?: string }
  ```
- Database queries use parameterized statements (`$1`, `$2`, …) via the custom `db.query()` wrapper.
- Prefer `async/await` over callbacks.

### Frontend
- Use **functional components** with hooks (no class components observed).
- Import order: React → third-party libraries → local components → utilities → CSS.
- Tailwind classes are written inline; no separate CSS modules for most components.
- Pixel-themed component names: `PixelButton`, `PixelCard`, `HeroHUD`, `BossArena`.

---

## 11. Testing Strategy

- **Backend**: No automated test suite is present. Testing is manual via the running API and health checks (`/api/health`, `/api/health/db`).
- **Frontend**: CRA includes Jest + React Testing Library by default, but no custom tests are written beyond the stock `App.test.js`.
- **Database**: Migrations are the primary schema validation mechanism. Seed data is embedded in the initial migration.

If you add tests, place them alongside the code they test or in a `__tests__` folder, following CRA conventions for the frontend and a standard `test/` or `.test.js` pattern for the backend.

---

## 12. Security Considerations

### ⚠️ Critical – Exposed secrets
The file **`backend/.env` is committed to the repository** and contains a live `DATABASE_URL` (with password) and a live `KIMI_API_KEY`. Treat this as a known issue. Any agent working on this project should **not push additional secrets** and should advise rotating these credentials.

### Auth & data
- Passwords are hashed with bcrypt (salt rounds 10).
- JWT secret and expiry are environment-driven.
- CORS is configured but currently logs warnings and allows all origins as a fallback (see `server.js` lines 54–58).
- Rate limiting is active but uses an in-memory store, so it resets on redeploy and does not scale across multiple backend instances without Redis.

### Safe practices
- Never log the full `DATABASE_URL` or API keys.
- Always validate user input (the `auth.js` route does manual regex validation).
- Keep `node_modules` and build directories out of git (already in `.gitignore`).

---

## 13. Deployment Notes

### Render (backend)
- Uses `render.yaml` blueprint.
- Build: `npm install`
- Start: `npm start`
- Health check: `/api/health`

### Vercel (frontend)
- `vercel.json` exists but is minimal.
- Set `REACT_APP_API_URL` to the deployed backend URL.

### Database connection limits
- The backend pool defaults to `max: 10` connections. On free Render plans with Supabase, keep this low to avoid "too many connections" errors.
- `db/connection.js` exposes `getPoolMetrics()` and retry logic for transient failures.

### Graceful shutdown
- `server.js` listens for `SIGTERM` and `SIGINT`, closes the HTTP server, then drains the Postgres pool with a 10-second timeout and a 15-second forced exit fallback.

---

## 14. Key Documentation References

| File | Purpose |
|------|---------|
| `backend/db.md` | Schema reference (columns, types, keys) |
| `Doc/StudyQuest-Rebuild-Spec.md` | Full spec for the project-based learning rebuild |
| `backend/db/migrations/studyquest_rebuild.sql` | Complete rebuild schema with RLS policies |
| `frontend/src/components/ui/README.md` | UI component notes |

---

## 15. Quick Start for Agents

1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
2. **Set environment variables** (copy and populate from `backend/.env` or `backend/.env.production.example`).
3. **Start backend**
   ```bash
   cd backend && npm run dev
   ```
4. **Start frontend**
   ```bash
   cd frontend && npm start
   ```
5. **Run migrations** (if setting up a fresh database)
   ```bash
   cd backend && npm run migrate
   ```
6. **Test login** (example curl in `login.md`)
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"alice@example.com","password":"Alice123"}'
   ```

---

*Last updated: 2026-04-29*
