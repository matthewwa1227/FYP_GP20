# StudyQuest - AI Coding Agent Guide

## Project Overview

**StudyQuest** is a gamified study companion application designed for Hong Kong secondary school students. It combines study tracking, gamification mechanics, AI-powered tutoring, and family collaboration features to create an engaging learning ecosystem.

This is a Final Year Project (FYP GP20) for the Higher Diploma in Software Engineering (2025/2026).

### Core Value Proposition
- **Students**: Earn XP, level up, maintain streaks, compete on leaderboards, and battle the "Shadow of Doom" (procrastination) through an RPG narrative
- **Parents**: Gain visibility into child's study habits via a dedicated dashboard with AI conversation review
- **Teachers**: Manage classes, create challenges, verify study sessions, and track student analytics
- **AI Features**: Age-appropriate tutoring with content tailored to the Hong Kong curriculum via Kimi K2.5

---

## Technology Stack

### Backend
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | >=18.0.0 |
| Framework | Express.js | 4.18.2 |
| Database | PostgreSQL | 15+ (Supabase hosted) |
| Authentication | JWT | jsonwebtoken 9.0.2 |
| Password Hashing | bcryptjs | 3.0.3 |
| AI Integration | OpenAI SDK | 6.17.0 (Kimi API via Moonshot AI) |
| CORS | cors | 2.8.5 |
| File Uploads | multer | 2.0.2 |
| Validation | express-validator | 7.0.1 |
| HTTP Client | axios | 1.13.5 |
| Web Scraping | cheerio | 1.2.0 |
| DB Client | pg | 8.16.3 |
| Dev Tool | nodemon | 3.0.1 |

### Frontend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React | 19.2.0 |
| Build Tool | Create React App | 5.0.1 |
| Routing | React Router DOM | 7.9.6 |
| Styling | Tailwind CSS | 3.4.1 |
| Animation | Framer Motion | 12.23.24 |
| Icons | Lucide React | 0.555.0 |
| Charts | Recharts | 3.5.1 |
| HTTP Client | Axios | 1.13.2 |

### Database
- **Type**: PostgreSQL 15+ (Supabase managed)
- **Connection**: `pg` library with connection pooling (`backend/db/connection.js`)
- **SSL**: Required for Supabase connections (`rejectUnauthorized: false`)
- **Migrations**: Sequential SQL files in `/backend/migrations` (001-017)

---

## Project Structure

```
FYP_GP20/
├── backend/                    # Express.js API server
│   ├── server.js               # Express app entry point
│   ├── package.json            # Backend dependencies
│   ├── .env                    # Environment variables (NEVER COMMIT)
│   ├── .env.production.example # Production env template
│   ├── Dockerfile              # Docker config for Fly.io
│   ├── nixpacks.toml           # Nixpacks build config
│   ├── railway.json            # Railway deployment config
│   ├── render.yaml             # Render deployment blueprint
│   ├── db.md                   # Database documentation
│   │
│   ├── routes/                 # API route handlers
│   │   ├── auth.js             # Authentication (register/login/onboarding)
│   │   ├── sessions.js         # Study session management
│   │   ├── achievements.js     # Achievement system
│   │   ├── tasks.js            # Task management
│   │   ├── ai.js               # Study Buddy AI chat
│   │   ├── aiStory.js          # AI schedule generation
│   │   ├── storyquest.js       # Story Quest RPG endpoints
│   │   ├── schedule.js         # Study schedule generator
│   │   ├── scheduleOptimizer.js# AI-optimized schedules
│   │   ├── progress.js         # Progress tracking & goals
│   │   ├── rewards.js          # Parent-teacher rewards
│   │   ├── teacher.js          # Teacher module
│   │   ├── social.js           # Study groups, friends, challenges
│   │   ├── family.js           # Parent-child linking
│   │   ├── leaderboard.js      # Leaderboard data
│   │   ├── dashboard.js        # Dashboard analytics
│   │   ├── revision.js         # Document-based learning
│   │   ├── exercises.js        # Printable worksheet generator
│   │   ├── projects.js         # StudyQuest Rebuild - Projects
│   │   ├── chapters.js         # StudyQuest Rebuild - Chapters
│   │   ├── attempts.js         # StudyQuest Rebuild - Quiz attempts
│   │   ├── bossBattles.js      # StudyQuest Rebuild - Boss battles
│   │   ├── artifacts.js        # StudyQuest Rebuild - Artifacts
│   │   ├── studyquest-rebuild.js # Legacy StudyQuest Rebuild routes
│   │   └── student.js          # Student profile
│   │
│   ├── controllers/            # Business logic
│   │   ├── aiController.js     # AI orchestration
│   │   └── revisionController.js # Document processing
│   │
│   ├── middleware/             # Express middleware
│   │   ├── auth.js             # JWT authentication
│   │   ├── concurrencyGuard.js # Rate limiting & health checks
│   │   └── scheduleGuard.js    # Schedule access control
│   │
│   ├── services/               # External service integrations
│   │   ├── kimiService.js      # Kimi AI service with tier-aware prompts
│   │   └── contentService.js   # PDF/DOCX/URL content extraction
│   │
│   ├── models/                 # Data models
│   │   └── Task.js             # Task model
│   │
│   ├── db/                     # Database
│   │   ├── connection.js       # PostgreSQL connection pool with retries
│   │   └── migrations/
│   │       └── studyquest_rebuild.sql
│   │
│   ├── migrations/             # SQL schema migrations (001-017)
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_parents.sql
│   │   ├── 003_ai.sql
│   │   ├── 004_Task.sql
│   │   ├── 005_tutor_sessions.sql
│   │   ├── 006_TutorUpdate.sql
│   │   ├── 007.sql
│   │   ├── 007_procrastination_prophecy.sql
│   │   ├── 008.sql
│   │   ├── 008_revision_mode.sql
│   │   ├── 009.sql
│   │   ├── 010.sql
│   │   ├── 011_comprehensive_features.sql
│   │   ├── 012_fix_role_constraint.sql
│   │   ├── 013_ai_media.sql
│   │   ├── 014_concurrent_access_fix.sql
│   │   ├── 015_studyquest_rebuild.sql
│   │   ├── 016_studyquest_seed_data.sql
│   │   ├── 017_newquest_boss_battles.sql
│   │   ├── ShowTable.sql
│   │   └── ShowTableColums.sql
│   │
│   ├── scripts/                # Utility scripts
│   │   └── migrate.js          # Database migration runner
│   │
│   ├── utils/                  # Utilities
│   │   ├── gamification.js     # Gamification helpers
│   │   └── logger.js           # Logging utility
│   │
│   └── uploads/                # File upload storage
│       └── exercises/
│
├── frontend/                   # Main React application
│   ├── package.json            # Frontend dependencies
│   ├── tailwind.config.js      # Tailwind theme (pixel game style)
│   ├── postcss.config.js       # PostCSS configuration
│   ├── vercel.json             # Vercel deployment config
│   ├── railway.json            # Railway deployment config
│   ├── nixpacks.toml           # Nixpacks build config
│   ├── public/                 # Static assets
│   └── src/
│       ├── App.js              # React router configuration
│       ├── index.js            # App entry point
│       ├── index.css           # Global styles (Press Start 2P font)
│       ├── setupTests.js       # Test configuration
│       ├── App.test.js         # Default CRA test
│       ├── TestAnimation.jsx   # Animation test page
│       │
│       ├── components/
│       │   ├── auth/           # Login.jsx, Register.jsx, ProtectedRoute.jsx
│       │   ├── dashboard/      # Dashboard.jsx, CourseCard.jsx
│       │   ├── StudyTimer/     # StudyTimer.jsx, BossArena.jsx, HeroHUD.jsx, etc.
│       │   ├── Achievements/   # Achievements.jsx, AchievementCard.jsx, AchievementNotification.jsx
│       │   ├── Tasks/          # Tasks.jsx
│       │   ├── StudyBuddy/     # StudyBuddy.jsx (AI chat)
│       │   ├── AITutor/        # StoryQuestAI.jsx, RevisionMode.jsx, AIBuddy.jsx, StudyJourney.jsx, concept.md
│       │   ├── ScheduleGenerator/# ScheduleGenerator.jsx
│       │   ├── Progress/       # ProgressDashboard.jsx
│       │   ├── Teacher/        # TeacherDashboard.jsx, TeacherLayout.jsx
│       │   ├── Social/         # SocialHub.jsx, ChallengeCard.jsx, FriendsList.jsx, etc.
│       │   ├── ExerciseGenerator/# ExerciseGenerator.jsx
│       │   ├── leaderboard/    # Leaderboard.jsx
│       │   ├── profile/        # Profile.jsx
│       │   ├── parent/         # ParentDashboard.jsx, LinkStudentPage.jsx
│       │   ├── portal/         # ParentPortal.jsx, ConnectParent.jsx, FamilyPortal.jsx
│       │   ├── layout/         # SideNavBar.jsx, TopAppBar.jsx, index.js
│       │   ├── questlog/       # QuestCard.jsx, HeroStatusSidebar.jsx, AddQuestModal.jsx, QuestFilters.jsx, index.js
│       │   ├── settings/       # Settings.jsx
│       │   ├── ui/             # Reusable UI components (Avatar.jsx, PixelButton.jsx, PixelCard.jsx, ProgressBar.jsx, README.md)
│       │   ├── Newquest/       # Newquest.jsx, index.js
│       │   ├── shared/         # Navbar.jsx, PixelButton.jsx, PixelCard.jsx, ProgressBar.jsx, StatCard.jsx
│       │   ├── FamilyConnectionManager.jsx
│       │   └── GuardianManagement.jsx
│       │
│       ├── context/
│       │   └── ThemeContext.jsx # Dark mode management
│       │
│       ├── hooks/
│       │   └── useStudySession.js # Custom study session hook
│       │
│       ├── pages/              # Top-level page components
│       │   ├── Dashboard.jsx
│       │   ├── QuestLog.jsx
│       │   ├── SocialHub.jsx
│       │   ├── StudyTimer.jsx
│       │   └── index.js
│       │
│       └── utils/
│           ├── auth.js         # Frontend auth utilities
│           ├── api.js          # Axios API client with interceptors
│           ├── familyApi.js    # Family-related API calls
│           └── cn.js           # Class name utilities
│
├── studyquest-app/             # Additional React app (legacy/experimental)
├── Doc/                        # Project documentation
├── Diagram/                    # Architecture diagrams
├── Diagram2/                   # Additional diagrams
├── PROJECT_OVERVIEW.md         # Technical project overview
├── DEPLOYMENT.md               # Railway deployment guide
├── DEPLOYMENT_FREE.md          # Free tier deployment options
├── DEPLOYMENT_QUICKSTART.md    # Quick deployment guide
├── SUPABASE_SETUP.md           # Supabase database setup
└── UI_AND_PIXEL_ART_GUIDE.md   # Design system and styling guide
```

---

## Build and Run Commands

### Backend

```bash
cd backend

# Install dependencies
npm install

# Development (with auto-reload via nodemon)
npm run dev

# Production
npm start

# Database migrations
npm run migrate

# Server runs on http://localhost:5000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Development server
npm start

# Production build
npm run build

# Tests
npm test

# App runs on http://localhost:3000
```

### Database Setup

```bash
# Run migrations using the migration script
cd backend && npm run migrate

# Or manually with psql
psql $DATABASE_URL -f migrations/001_initial_schema.sql
psql $DATABASE_URL -f migrations/002_add_parents.sql
# ... continue through all migrations in numerical order
```

---

## Environment Variables

Create `backend/.env`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@[host]:6543/postgres

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=24h

# AI APIs
KIMI_API_KEY=sk-xxxxxxxxxxxxxxxx

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
CUSTOM_DOMAIN=

# Pool config (optional)
DB_POOL_MAX=10
DB_POOL_MIN=2
```

Create `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

**IMPORTANT**: The `.env` file contains sensitive credentials. Never commit it to git (already in `.gitignore`).

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| students | User accounts (students, parents, teachers), gamification stats |
| study_sessions | Individual study session records |
| achievements | Available achievements/badges definitions |
| student_achievements | Unlocked achievements per student |
| daily_goals | Daily study targets and progress |
| tasks | User-created tasks with priorities |
| family_links | Parent-child relationship links |
| ai_conversations | Chat history with Study Buddy |
| revision_documents | Uploaded documents for revision mode |

### StudyQuest Rebuild Tables

| Table | Purpose |
|-------|---------|
| projects | Adaptive project-based learning paths |
| chapters | Individual learning units within projects |
| questions | Mixed-type quiz questions per chapter |
| question_attempts | Tracks all student tries with AI diagnosis |
| knowledge_artifacts | Student's reference library (cheat sheets) |
| boss_battles | Multi-stage synthesis challenges |
| boss_stage_attempts | Individual stage submissions |
| artifact_access_logs | Analytics for artifact usage |

### Key Database Features
- **UUID Primary Keys**: All main entities use UUIDs
- **Foreign Key Constraints**: Proper referential integrity with CASCADE deletes
- **Triggers**: Auto-update `updated_at` timestamps, auto-calculate student stats, auto-check chapter completion
- **Row Level Security (RLS)**: Enabled on StudyQuest Rebuild tables with user isolation policies
- **Views**: `student_leaderboard`, `recent_sessions` for analytics
- **Connection Pooling**: Configurable pool size with retry logic and deadlock handling

---

## Authentication System

### JWT Token Structure
```javascript
{
  studentId: UUID,
  id: UUID,
  email: String,
  username: String,
  role: 'student' | 'parent' | 'teacher',
  formLevel: 'P1'-'P6' | 'S1'-'S6' | null,
  ageTier: 'P1-P3' | 'P4-P6' | 'S1-S3' | 'S4-S6' | null
}
```

### User Roles
| Role | Access |
|------|--------|
| student | Dashboard, Progress, Social, Story Quest, AI Tutor, Tasks, Newquest |
| teacher | Teacher Dashboard, Class Management, Student Analytics, Session Verification |
| parent | Parent Portal, View Child Progress, Rewards Management, Schedule Management |

### Form Levels (HK Education System)
- **P1-P6**: Primary 1-6 (ages 6-11)
- **S1-S6**: Secondary 1-6 (ages 12-17, includes DSE)

### Auth Endpoints
- `POST /api/auth/register` - Register student/parent/teacher
- `POST /api/auth/register-parent` - Convenience endpoint for parent registration
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (lightweight)
- `GET /api/auth/profile` - Get full profile
- `PATCH /api/auth/onboarding` - Set form level after registration

---

## API Endpoints

### Route Registration (from `server.js`)
- `POST /api/auth/*` - Authentication
- `GET|POST /api/sessions/*` - Study sessions (`/active`, `/start`, `/:id/end`)
- `GET|PUT /api/student/*` - Student profile and stats
- `GET|POST /api/achievements/*` - Achievements
- `GET /api/leaderboard/*` - Leaderboards (`/global`, `/my-rank`, `/rank/:userId`)
- `GET /api/dashboard/*` - Dashboard analytics
- `GET|POST /api/family/*` - Family linking and parent features
- `POST|GET /api/ai/*` - AI chat and capabilities
- `GET|POST|PUT|DELETE /api/tasks/*` - Task management
- `POST /api/ai/story/*` - AI story generation
- `POST /api/storyquest/*` - Story Quest RPG (`/intro`, `/learn`, `/question`, `/scene`)
- `POST /api/schedule/*` - Schedule generation
- `POST|GET /api/revision/*` - Document upload, quiz generation, URL fetching
- `GET|POST /api/progress/*` - Progress tracking
- `GET|POST /api/rewards/*` - Rewards system
- `GET|POST /api/teacher/*` - Teacher module
- `GET|POST /api/social/*` - Social features
- `POST /api/schedule-optimizer/*` - AI schedule optimization
- `POST /api/exercises/*` - Exercise and worksheet generation
- `GET|POST /api/study/*` - Legacy StudyQuest Rebuild routes
- `GET|POST /api/projects/*` - Projects (Rebuild)
- `GET|POST /api/chapters/*` - Chapters (Rebuild)
- `GET|POST /api/attempts/*` - Quiz attempts (Rebuild)
- `GET|POST /api/boss-battles/*` - Boss battles (Rebuild)
- `GET|POST /api/artifacts/*` - Artifacts (Rebuild)

### Health & Monitoring
- `GET /api/health` - Server health check with DB status and pool metrics
- `GET /api/health/db` - Detailed database metrics (connections, utilization)
- `GET /api` - Root API info

---

## Code Style Guidelines

### JavaScript/React
- Use ES6+ features (async/await, destructuring, arrow functions)
- Component files use PascalCase (e.g., `StudyTimer.jsx`)
- Utility files use camelCase (e.g., `auth.js`)
- CSS classes follow Tailwind convention
- Route files use camelCase (e.g., `scheduleOptimizer.js`)

### Backend
- API responses follow pattern: `{ success: boolean, message?: string, data?: any }`
- Error handling with try/catch
- Console logging with emoji prefixes:
  - ✅ - Success
  - ❌ - Error
  - 📊 - Database/query
  - 💡 - Debug/info
  - 🚀 - API calls
  - 🔄 - Retry/warning
  - ⚠️ - Warning
  - ⏱️ - Timeout
  - 🔍 - Testing/inspection
  - 🎉 - Completion

### SQL
- Use uppercase for keywords (CREATE, SELECT, INSERT)
- Use lowercase for identifiers
- Include comments for complex queries
- Always use parameterized queries (`$1`, `$2`) to prevent SQL injection

### React Component Structure
```jsx
// Imports (grouped: React, external libs, internal, styles)
import React from 'react';
import { motion } from 'framer-motion';
import { PixelButton } from '../shared/PixelButton';

// Component
export function ComponentName({ prop1, prop2 }) {
  // Hooks at top
  const [state, setState] = useState();
  
  // Handlers
  const handleClick = () => { ... };
  
  // Render
  return (
    <div className="bg-surface p-4">
      {/* JSX */}
    </div>
  );
}
```

---

## Testing Strategy

### Manual Testing
- API testing via Postman/curl
- Frontend testing via React Testing Library (included in CRA)
- Only one default test file exists: `frontend/src/App.test.js`

### Health Check Endpoints
```bash
# Backend health
curl http://localhost:5000/api/health

# Database test
curl http://localhost:5000/api/health/db

# Root API
curl http://localhost:5000/api
```

### No Dedicated Backend Test Framework
There is no Jest/Mocha test suite for the backend. Changes to backend logic should be verified via:
1. Health checks
2. Direct API calls
3. Frontend integration testing

---

## Security Considerations

1. **Authentication**: JWT tokens expire after 24 hours (`JWT_EXPIRES_IN`)
2. **Passwords**: Hashed with bcrypt (10 salt rounds)
3. **Database**: SSL required for Supabase connections
4. **CORS**: Configured for frontend origin with regex support for deployed domains. **Note**: The current CORS config in `server.js` logs warnings but allows all origins for debugging.
5. **SQL Injection**: Prevented via parameterized queries
6. **Input Validation**: Express-validator on all inputs; regex validation in auth routes
7. **File Uploads**: Limited file types and sizes for documents (multer)
8. **Rate Limiting** (`middleware/concurrencyGuard.js`):
   - General: 100 requests/minute per IP
   - Authenticated: 20 requests/minute per user
   - Session actions: 10/minute per user
   - Login: 5 attempts per 15 minutes per IP/email
9. **XSS Protection**: Headers configured in Vercel deployment (`X-Frame-Options`, `X-XSS-Protection`, `X-Content-Type-Options`)
10. **Request Timeout**: 55-second timeout on all requests to prevent hanging connections
11. **Graceful Shutdown**: Closes HTTP server and DB pool on SIGTERM/SIGINT

---

## Key Features Implementation

### 1. Gamification System (The Procrastination Prophecy)
- **XP Calculation**: 1 minute = 1 XP base, bonuses for longer sessions
- **Level System**: XP thresholds for level progression
- **Streaks**: Daily login tracking, affects Hero Power
- **Achievements**: Tiered badges (bronze, silver, gold, platinum)
- **Hero Power**: Increases with streaks (max 100)
- **Shadow of Doom**: Grows when missing study days (0-100)

### 2. Age-Tier System
Students are categorized by form level:

| Tier | Levels | Ages | Language Style |
|------|--------|------|----------------|
| P1-P3 | P1-P3 | 6-8 | Very simple English, 5-8 word sentences |
| P4-P6 | P4-P6 | 9-11 | Clear simple English, everyday examples |
| S1-S3 | S1-S3 | 12-14 | Normal English, school words OK |
| S4-S6 | S4-S6 | 15-17 | Proper school English, DSE-level |

### 3. AI Integration (Kimi/Moonshot)
Located in `backend/services/kimiService.js`:
- Model: `kimi-k2.5`
- Timeout: 60 seconds
- Max tokens: 2000 for chat
- Thinking mode: Enabled for chat
- Base URL: `https://api.moonshot.cn/v1`
- Tier-aware prompts via `buildTierInstructions(tierInfo)` helper
- Strict meta-question filtering for quiz generation
- Subject-specific fallback questions for History, Science, Math, Geography

### 4. Pixel Art UI Theme
- Font: "Press Start 2P" (Google Fonts) for RPG elements; "Space Grotesk" and "Inter" for UI
- Color palette: Dark purple theme with pink (`#ff4a8d`), cyan (`#00f1fe`), and gold (`#e9c400`) accents
- Components: Pixel borders, retro buttons, 8-bit styling, segmented progress bars
- Tailwind config: Custom `pixel-*` colors and `shadow-pixel` utilities
- Scrollbar: Custom pixel-styled scrollbar in `index.css`

### 5. StudyQuest Rebuild (Adaptive Learning)
- **Projects**: Topic-based learning paths with skill trees
- **Chapters**: Sequential learning units with prerequisites
- **Questions**: Mixed types (multiple choice, code execution, fill blank, error analysis, debugging, prediction, concept synthesis)
- **Artifacts**: AI-generated cheat sheets that students can reference during quizzes
- **Boss Battles**: Multi-stage synthesis challenges unlocked at confidence threshold
- **Diagnosis**: AI provides specific misconception tags and explanations for wrong answers

---

## Deployment

### Supported Platforms

| Platform | Service | Config File |
|----------|---------|-------------|
| Vercel | Frontend | `vercel.json` |
| Railway | Full stack | `railway.json` (both frontend and backend) |
| Render | Backend | `render.yaml` |
| Fly.io | Backend | `Dockerfile` |
| Supabase | Database | - |

### Production Backend URL (currently configured)
- Render: `https://studyquest-api-mqt5.onrender.com/api`

### Deployment Checklist
- [ ] Database migrations applied (run `npm run migrate`)
- [ ] Environment variables configured
- [ ] Health check endpoint responding (`/api/health`)
- [ ] CORS origins updated for production
- [ ] Frontend API URL pointing to production backend

See `DEPLOYMENT.md` for detailed deployment instructions.

---

## Common Development Tasks

### Adding a New API Endpoint
1. Create route handler in `backend/routes/[feature].js`
2. Add route registration in `backend/server.js`
3. Add corresponding API client method in `frontend/src/utils/api.js`
4. Create frontend component in `frontend/src/components/[Feature]/`
5. Add route in `frontend/src/App.js`

### Adding a Database Migration
1. Create new file `backend/migrations/XXX_description.sql` (next sequential number after 017)
2. Include both `CREATE TABLE` and rollback statements as comments
3. Run migration: `cd backend && npm run migrate`

### Working with AI Features
1. Service logic goes in `backend/services/kimiService.js`
2. Route handlers in `backend/routes/ai.js` or `backend/routes/storyquest.js`
3. Frontend components in `frontend/src/components/StudyBuddy/` or `frontend/src/components/AITutor/`
4. Use tier-aware prompts via `buildTierInstructions(tierInfo)` helper

---

## Troubleshooting

### Database Connection Issues
- Check `DATABASE_URL` format in `.env`
- Verify SSL settings for Supabase (`rejectUnauthorized: false`)
- Test connection: `curl http://localhost:5000/api/health`
- Check pool metrics: `curl http://localhost:5000/api/health/db`
- Connection pool config is in `backend/db/connection.js` (`max: 10`, `min: 2` by default)

### AI API Errors
- Verify `KIMI_API_KEY` is set in `.env`
- Check API key validity at Moonshot AI console
- Monitor server logs for detailed error messages
- Kimi service timeout is 60 seconds

### Frontend Build Issues
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version (requires 18+)
- Verify `REACT_APP_API_URL` environment variable if using custom backend URL

### CORS Errors
- Ensure `FRONTEND_URL` env var matches actual frontend origin
- Check that deployed domain matches CORS patterns in `server.js`
- Redeploy backend after changing CORS settings
- **Current behavior**: CORS logs warnings but allows all origins for debugging

### Rate Limiting (429 Errors)
- General limit: 100 req/min per IP
- Authenticated limit: 20 req/min per user
- Login limit: 5 attempts per 15 minutes
- Check `X-RateLimit-*` headers in responses

---

## Useful Commands Reference

```bash
# Backend development
cd backend && npm run dev

# Frontend development
cd frontend && npm start

# Database connection test
curl http://localhost:5000/api/health

# View logs (Railway)
railway logs -f

# Deploy to Railway
cd backend && railway up
cd frontend && railway up

# Run migrations
cd backend && npm run migrate
```

---

*Last updated: April 2026*
