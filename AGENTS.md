# StudyQuest - AI Coding Agent Guide

## Project Overview

**StudyQuest** is a gamified study companion application designed for Hong Kong secondary school students. It combines study tracking, gamification mechanics, AI-powered tutoring, and family collaboration features to create an engaging learning ecosystem.

This is a Final Year Project (FYP GP20) for the Higher Diploma in Software Engineering (2025/2026).

### Core Value Proposition
- **Students**: Earn XP, level up, maintain streaks, compete on leaderboards, and battle the "Shadow of Doom" (procrastination) through RPG narrative
- **Parents**: Gain visibility into child's study habits via dedicated dashboard with AI conversation review
- **Teachers**: Manage classes, create challenges, verify study sessions, and track student analytics
- **AI Features**: Age-appropriate tutoring with content tailored to Hong Kong curriculum via Kimi K2.5

---

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ (Express.js 4.x)
- **Database**: PostgreSQL 15+ (hosted on Supabase)
- **Authentication**: JWT (JSON Web Tokens) with 24h expiry
- **Password Hashing**: bcryptjs (10 salt rounds)
- **AI Integration**: Kimi API (Moonshot AI) via OpenAI SDK
- **CORS**: Enabled for cross-origin requests
- **File Uploads**: Multer for document processing

### Frontend
- **Framework**: React 19+ (Create React App)
- **Routing**: React Router v7
- **Styling**: Tailwind CSS 3.4+ with custom pixel-art theme
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **Charts**: Recharts for analytics
- **HTTP Client**: Axios with interceptors

### Database
- **Type**: PostgreSQL 15+ (Supabase managed)
- **Connection**: `pg` library with connection pooling
- **SSL**: Required for Supabase connections
- **Migrations**: Sequential SQL files in `/migrations`

---

## Project Structure

```
FYP_GP20/
├── backend/                    # Express.js API server
│   ├── routes/                 # API route handlers
│   │   ├── auth.js            # Authentication (register/login/onboarding)
│   │   ├── sessions.js        # Study session management
│   │   ├── achievements.js    # Achievement system
│   │   ├── tasks.js           # Task management
│   │   ├── ai.js              # Study Buddy AI chat
│   │   ├── aiStory.js         # AI schedule generation
│   │   ├── storyquest.js      # Story Quest RPG endpoints
│   │   ├── schedule.js        # Study schedule generator
│   │   ├── scheduleOptimizer.js # AI-optimized schedules
│   │   ├── progress.js        # Progress tracking & goals
│   │   ├── rewards.js         # Parent-teacher rewards
│   │   ├── teacher.js         # Teacher module (classes, analytics)
│   │   ├── social.js          # Study groups, friends, challenges
│   │   ├── family.js          # Parent-child linking
│   │   ├── leaderboard.js     # Leaderboard data
│   │   ├── dashboard.js       # Dashboard analytics
│   │   ├── revision.js        # Document-based learning
│   │   ├── exercises.js       # Printable worksheet generator
│   │   └── student.js         # Student profile
│   ├── controllers/            # Business logic
│   │   ├── aiController.js    # AI orchestration
│   │   └── revisionController.js # Document processing
│   ├── middleware/             # Express middleware
│   │   ├── auth.js            # JWT authentication (authenticateToken, optionalAuth)
│   │   └── scheduleGuard.js   # Schedule access control
│   ├── models/                 # Data models
│   │   └── Task.js            # Task model
│   ├── services/               # External service integrations
│   │   ├── kimiService.js     # Kimi AI service with tier-aware prompts
│   │   └── contentService.js  # PDF/DOCX/URL content extraction
│   ├── db/                     # Database
│   │   └── connection.js      # PostgreSQL connection pool with timeouts
│   ├── migrations/             # SQL schema migrations (001-013)
│   │   ├── 001_initial_schema.sql      # Core tables
│   │   ├── 002_add_parents.sql         # Parent relationships
│   │   ├── 003_ai.sql                  # AI conversations
│   │   ├── 004_Task.sql                # Task management
│   │   ├── 005_tutor_sessions.sql      # AI tutoring
│   │   ├── 007_procrastination_prophecy.sql # Hero/Shadow gamification
│   │   ├── 008_revision_mode.sql       # Document revision
│   │   ├── 011_comprehensive_features.sql # Goals, rewards, social, analytics
│   │   └── 012_fix_role_constraint.sql # Add 'teacher' role
│   ├── utils/                  # Utility functions
│   ├── server.js              # Express app entry point
│   └── .env                   # Environment variables (NEVER COMMIT)
├── frontend/                   # Main React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/          # Login.jsx, Register.jsx
│   │   │   ├── dashboard/     # Dashboard.jsx, CourseCard.jsx
│   │   │   ├── StudyTimer/    # StudyTimer.jsx (Pomodoro timer)
│   │   │   ├── Achievements/  # Achievements.jsx, AchievementCard.jsx
│   │   │   ├── Tasks/         # Tasks.jsx
│   │   │   ├── StudyBuddy/    # StudyBuddy.jsx (AI chat)
│   │   │   ├── AITutor/       # StoryQuestAI.jsx, RevisionMode.jsx
│   │   │   ├── ScheduleGenerator/  # ScheduleGenerator.jsx
│   │   │   ├── ScheduleOptimizer/  # Schedule optimizer UI
│   │   │   ├── Progress/      # ProgressDashboard.jsx
│   │   │   ├── Teacher/       # TeacherDashboard.jsx, TeacherLayout.jsx
│   │   │   ├── Social/        # SocialHub.jsx
│   │   │   ├── ExerciseGenerator/  # ExerciseGenerator.jsx
│   │   │   ├── leaderboard/   # Leaderboard.jsx
│   │   │   ├── profile/       # Profile.jsx
│   │   │   ├── parent/        # ParentDashboard.jsx, LinkStudentPage.jsx
│   │   │   ├── portal/        # ParentPortal.jsx, ConnectParent.jsx, FamilyPortal.jsx
│   │   │   └── shared/        # Navbar.jsx, PixelButton.jsx, PixelCard.jsx
│   │   ├── utils/
│   │   │   ├── auth.js        # Frontend auth utilities
│   │   │   └── api.js         # Axios API client with interceptors
│   │   ├── App.js             # React router configuration
│   │   └── index.js           # App entry point
│   ├── tailwind.config.js     # Tailwind theme (pixel game style)
│   └── package.json
├── studyquest-app/            # Alternative/legacy React app (not actively used)
├── Doc/                       # Project documentation
│   ├── Project Plan.md
│   ├── Table_Of_Content.md
│   └── *.docx, *.pptx         # Reports and presentations
└── Diagram/                   # Architecture diagrams
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

# Server runs on http://localhost:5000
```

### Frontend (Main)

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

### Environment Variables (Backend)

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
```

**IMPORTANT**: The `.env` file contains sensitive credentials. Never commit it to git.

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `students` | User accounts (students, parents, teachers), gamification stats |
| `study_sessions` | Individual study session records |
| `achievements` | Available achievements/badges definitions |
| `student_achievements` | Unlocked achievements per student |
| `daily_goals` | Daily study targets and progress |
| `tasks` | User-created tasks with priorities |

### Gamification Tables

| Table | Purpose |
|-------|---------|
| `hero_journeys` | Procrastination Prophecy RPG progress |
| `journey_stages` | 10-stage hero journey definitions |
| `journey_logs` | Daily study logs with narrative context |
| `narrative_events` | Story events in meta-narrative |

### AI-Related Tables

| Table | Purpose |
|-------|---------|
| `ai_conversations` | Chat history with Study Buddy (for parent review) |
| `conversation_reviewers` | Parent/teacher permissions for AI review |
| `tutor_sessions` | AI tutoring session records |
| `tutor_messages` | Messages within tutoring sessions |

### Social & Collaboration Tables

| Table | Purpose |
|-------|---------|
| `study_groups` | Study group definitions |
| `study_group_members` | Group membership |
| `friendships` | Friend connections |
| `challenges` | Study challenges |
| `challenge_participants` | Challenge progress tracking |

### Teacher Module Tables

| Table | Purpose |
|-------|---------|
| `classes` | Teacher class management |
| `class_students` | Class enrollment |
| `class_challenges` | Class-specific challenges |
| `student_analytics` | Aggregated analytics for teachers |
| `session_verifications` | Teacher verification of study sessions |

### Progress & Rewards Tables

| Table | Purpose |
|-------|---------|
| `student_goals` | Personal study goals |
| `progress_tracking` | Detailed daily/weekly progress |
| `reward_definitions` | Parent/teacher-created rewards |
| `student_rewards` | Earned/unlocked rewards |
| `optimized_schedules` | AI-generated study schedules |

### Key Database Features
- **UUID Primary Keys**: All main entities use UUIDs
- **Foreign Key Constraints**: Proper referential integrity with CASCADE deletes
- **Triggers**: Auto-update `updated_at` timestamps, auto-calculate student stats
- **Views**: `student_leaderboard`, `recent_sessions`, `hero_journey_summary` for analytics
- **Functions**: `calculate_hero_power()`, `calculate_shadow_doom()` for gamification

---

## Authentication System

### JWT Token Structure
```javascript
{
  studentId: UUID,
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
| `student` | Dashboard, Progress, Social, Story Quest, AI Tutor, Tasks |
| `teacher` | Teacher Dashboard, Class Management, Student Analytics, Session Verification |
| `parent` | Parent Portal, View Child Progress, Rewards Management, AI Conversation Review |

### Protected Routes
Routes use `authenticateToken` middleware:
```javascript
const { authenticateToken } = require('../middleware/auth');
router.get('/profile', authenticateToken, async (req, res) => { ... });
```

### Frontend Auth Utilities
Located in `frontend/src/utils/auth.js`:
- `setAuth(token, user)` - Store auth data in localStorage
- `getAuth()` - Retrieve auth data
- `getUser()` - Get current user object
- `getToken()` - Get JWT token
- `isAuthenticated()` - Check login status
- `logout()` - Clear auth data

### API Client
Located in `frontend/src/utils/api.js`:
- Axios instance with base URL `http://localhost:5000/api`
- Request interceptor adds Authorization header with JWT
- Response interceptor handles 401 errors (auto logout)

---

## Code Style Guidelines

### JavaScript/React
- Use ES6+ features (async/await, destructuring, arrow functions)
- Component files use PascalCase (e.g., `StudyTimer.jsx`)
- Utility files use camelCase (e.g., `auth.js`)
- CSS classes follow Tailwind convention
- Use single quotes for strings

### Backend
- Route handlers use snake_case for SQL columns
- API responses follow pattern: `{ success: boolean, message?: string, data?: any }`
- Error handling with try/catch
- Console logging with emoji prefixes:
  - `✅` - Success
  - `❌` - Error
  - `📊` - Database/query
  - `🔍` - Debug/info
  - `🚀` - API calls

### SQL
- Use uppercase for keywords (CREATE, SELECT, INSERT)
- Use lowercase for identifiers
- Include comments for complex queries
- Always use parameterized queries (`$1, $2`) to prevent SQL injection

### Git
- `.env` files are gitignored
- `node_modules/` directories are gitignored
- Migration files should be committed

---

## Key Features Implementation

### 1. Gamification System (The Procrastination Prophecy)
- **XP Calculation**: 1 minute = 1 XP base, bonuses for longer sessions
- **Level System**: XP thresholds for level progression
- **Streaks**: Daily login tracking, affects "Hero Power"
- **Achievements**: Tiered badges (bronze, silver, gold, platinum)
- **Hero Power**: Increases with streaks (max 100)
- **Shadow of Doom**: Grows when missing study days (0-100)
- **Backend**: `services/kimiService.js` (NARRATIVE_CONTEXT), `migrations/007_procrastination_prophecy.sql`
- **Frontend**: Dashboard displays Hero Status card

### 2. Age-Tier System
Students are categorized by form level:
| Tier | Levels | Ages | Language Style |
|------|--------|------|----------------|
| `P1-P3` | P1-P6 | 6-8 | Very simple English, 5-8 word sentences |
| `P4-P6` | P4-P6 | 9-11 | Clear simple English, everyday examples |
| `S1-S3` | S1-S3 | 12-14 | Normal English, school words OK |
| `S4-S6` | S4-S6 | 15-17 | Proper school English, DSE-level |

AI content is automatically adjusted based on the student's tier via `TIER_PROMPT_CONFIG` in `kimiService.js`.

### 3. AI Integration (Kimi/Moonshot)
Located in `backend/services/kimiService.js`:

**Main Functions:**
- `chatWithStudyBuddy()` - Chat-based learning assistant
- `generateStoryIntro()` - Story Quest RPG intro generation
- `generateStoryScene()` - RPG scene generation
- `generateStoryLesson()` - Educational content generation
- `generateStoryQuestion()` - Quiz question generation (with subject validation)
- `generateStudySchedule()` - AI-assisted study planning

**Configuration:**
- Model: `kimi-k2.5`
- Timeout: 60 seconds
- Max tokens: 2000 for chat, varies for other functions
- Thinking mode: Enabled for chat

### 4. Story Quest RPG
- **Flow**: Select Subject → Choose Topic → Story Intro → Learn → Quiz → Battle → Victory
- **Backend**: `routes/storyquest.js`, `routes/aiStory.js`
- **Frontend**: `components/AITutor/StoryQuestAI.jsx`
- **Features**: AI-generated lessons, interactive choices, boss battles, XP rewards

### 5. Parent Features
- **Child Linking**: Via 6-digit connection codes
- **Dashboard**: View child's study statistics, goals, progress
- **AI Review**: View and flag child's AI conversations
- **Rewards**: Create and manage reward systems
- **Backend**: `routes/family.js`
- **Frontend**: `components/parent/ParentDashboard.jsx`

### 6. Teacher Module
- **Class Management**: Create classes, generate class codes
- **Student Analytics**: Track study time, accuracy, engagement
- **Session Verification**: Verify student study sessions
- **Challenges**: Create class-specific challenges
- **Backend**: `routes/teacher.js`
- **Frontend**: `components/Teacher/TeacherDashboard.jsx`

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register student/parent/teacher
- `POST /api/auth/register-parent` - Register as parent
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (lightweight)
- `GET /api/auth/profile` - Get full profile
- `PATCH /api/auth/onboarding` - Set form level after registration

### Study Sessions
- `GET /api/sessions/active` - Get active session
- `POST /api/sessions/start` - Start new session
- `POST /api/sessions/:id/end` - End session
- `GET /api/sessions/history` - Get session history

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PATCH /api/tasks/:id/toggle` - Toggle completion

### AI Features
- `POST /api/ai/chat` - Chat with Study Buddy
- `GET /api/ai/history` - Get chat history
- `POST /api/ai/generate-schedule` - Generate study schedule

### Story Quest
- `POST /api/storyquest/intro` - Generate story intro
- `POST /api/storyquest/learn` - Get lesson content
- `POST /api/storyquest/question` - Generate quiz question

### Family
- `POST /api/family/generate-code` - Generate connection code (student)
- `POST /api/family/link-child` - Link to child (parent)
- `GET /api/family/children-stats` - Get linked children stats
- `GET /api/family/guardians` - Get student's guardians

### Progress
- `GET /api/progress/dashboard` - Get progress dashboard data
- `POST /api/progress/goals` - Create goal

### Teacher
- `GET /api/teacher/classes` - Get teacher's classes
- `POST /api/teacher/classes` - Create class
- `GET /api/teacher/analytics` - Get class analytics

### Social
- `GET /api/social/groups` - Get study groups
- `POST /api/social/groups` - Create group
- `GET /api/social/friends` - Get friends list

---

## Testing Strategy

### Manual Testing
- API testing via Postman/curl
- Frontend testing via React Testing Library (included in CRA)

### Health Check Endpoints
```bash
# Backend health
curl http://localhost:5000/api/health

# Database test
curl http://localhost:5000/api/db/test

# Root API
curl http://localhost:5000/api
```

### Test Commands
```bash
# Frontend tests
cd frontend && npm test

# Backend start (manual testing)
cd backend && npm run dev
```

---

## Development Conventions

### Environment Management
- **Development**: Local server + Supabase PostgreSQL
- **Production**: Deployed backend + Supabase (managed PostgreSQL)
- Never expose `JWT_SECRET` or API keys in client code

### Code Organization
- Keep business logic in controllers/services
- Keep route handlers thin (validation + call service)
- Use middleware for cross-cutting concerns (auth, logging)

### Adding a New API Endpoint
1. Create route handler in `backend/routes/`
2. Add route to `backend/server.js`
3. Use `authenticateToken` middleware if protected
4. Return consistent response format: `{ success, message?, data? }`

### Adding a New Database Table
1. Create migration file in `backend/migrations/`
2. Follow naming convention: `XXX_description.sql`
3. Run migration manually via `psql $DATABASE_URL -f migrations/XXX.sql`
4. Update this documentation

### Adding a New Frontend Component
1. Create component in appropriate `frontend/src/components/` subdirectory
2. Use PascalCase for component name
3. Add route to `frontend/src/App.js` if needed
4. Use Tailwind classes for styling
5. Use `lucide-react` for icons
6. Use shared components (PixelButton, PixelCard) for consistency

---

## Security Considerations

1. **Authentication**: JWT tokens expire after 24 hours
2. **Passwords**: Hashed with bcrypt (10 salt rounds)
3. **Database**: SSL required for Supabase connections
4. **CORS**: Configured for frontend origin
5. **SQL Injection**: Prevented via parameterized queries
6. **Input Validation**: Express-validator on all inputs
7. **File Uploads**: Limited file types and sizes for documents

---

## Troubleshooting

### Database Connection Issues
- Check `DATABASE_URL` format in `.env`
- Ensure SSL is enabled for Supabase (`rejectUnauthorized: false`)
- Verify network access to Supabase
- Check connection timeout settings (10s default)

### AI API Issues
- Verify `KIMI_API_KEY` is set in `.env`
- Check API key hasn't expired
- Monitor API rate limits
- Check Kimi service logs for detailed error messages

### Frontend-Backend Communication
- Ensure CORS is properly configured in backend
- Check that backend is running on correct port (5000)
- Verify API URLs in frontend (`utils/api.js`)
- Check browser console for CORS errors

### Common Errors
- **401 Unauthorized**: Token expired or invalid, redirect to login
- **403 Forbidden**: Valid token but insufficient permissions
- **500 Server Error**: Check backend console logs

---

## Team Structure

| Member | Role | Responsibilities |
|--------|------|------------------|
| Cheung King Wa | Frontend Lead | React, UI/UX, PWA, Mobile |
| Wang Wai Shing | Backend Lead | API, Database, Auth, Security |
| Liang Fai Hung | AI Specialist | Kimi APIs, Data Visualization |
| Siu Tsz Kin | QA & Security | Testing, Security audits |

---

## Documentation References

- `Doc/Project Plan.md` - Full project plan
- `Doc/Table_Of_Content.md` - Report structure
- `PROJECT_OVERVIEW.md` - Technical project overview
- `UI_AND_PIXEL_ART_GUIDE.md` - Design system and styling guide
- `backend/migrations/*.sql` - Schema evolution

---

*Last updated: March 2026*
