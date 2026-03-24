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
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express.js | 4.x |
| Database | PostgreSQL | 15+ (Supabase hosted) |
| Authentication | JWT | jsonwebtoken 9.x |
| Password Hashing | bcryptjs | 3.0.3 |
| AI Integration | OpenAI SDK | Kimi API (Moonshot AI) |
| CORS | cors | 2.8.5 |
| File Uploads | multer | 2.0.2 |
| Validation | express-validator | 7.0.1 |
| HTTP Client | axios | 1.13.x |
| Web Scraping | cheerio | 1.2.0 |
| DB Client | pg | 8.16.3 |

### Frontend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React | 19+ |
| Build Tool | Create React App | 5.0.1 |
| Routing | React Router DOM | 7.x |
| Styling | Tailwind CSS | 3.4+ |
| Animation | Framer Motion | 12.x |
| Icons | Lucide React | 0.555.0 |
| Charts | Recharts | 3.5.1 |
| HTTP Client | Axios | 1.13.x |

### Database
- **Type**: PostgreSQL 15+ (Supabase managed)
- **Connection**: `pg` library with connection pooling
- **SSL**: Required for Supabase connections (`rejectUnauthorized: false`)
- **Migrations**: Sequential SQL files in `/backend/migrations`

---

## Project Structure

```
FYP_GP20/
�u�w�w backend/                    # Express.js API server
�x   �u�w�w server.js              # Express app entry point
�x   �u�w�w package.json           # backend dependencies
�x   �u�w�w .env                   # Environment variables (NEVER COMMIT)
�x   �x
�x   �u�w�w routes/                # API route handlers
�x   �x   �u�w�w auth.js           # Authentication (register/login/onboarding)
�x   �x   �u�w�w sessions.js       # Study session management
�x   �x   �u�w�w achievements.js   # Achievement system
�x   �x   �u�w�w tasks.js          # Task management
�x   �x   �u�w�w ai.js             # Study Buddy AI chat
�x   �x   �u�w�w aiStory.js        # AI schedule generation
�x   �x   �u�w�w storyquest.js     # Story Quest RPG endpoints
�x   �x   �u�w�w schedule.js       # Study schedule generator
�x   �x   �u�w�w scheduleOptimizer.js # AI-optimized schedules
�x   �x   �u�w�w progress.js       # Progress tracking & goals
�x   �x   �u�w�w rewards.js        # Parent-teacher rewards
�x   �x   �u�w�w teacher.js        # Teacher module
�x   �x   �u�w�w social.js         # Study groups, friends, challenges
�x   �x   �u�w�w family.js         # Parent-child linking
�x   �x   �u�w�w leaderboard.js    # Leaderboard data
�x   �x   �u�w�w dashboard.js      # Dashboard analytics
�x   �x   �u�w�w revision.js       # Document-based learning
�x   �x   �u�w�w exercises.js      # Printable worksheet generator
�x   �x   �|�w�w student.js        # Student profile
�x   �x
�x   �u�w�w controllers/           # Business logic
�x   �x   �u�w�w aiController.js   # AI orchestration
�x   �x   �|�w�w revisionController.js # Document processing
�x   �x
�x   �u�w�w middleware/            # Express middleware
�x   �x   �u�w�w auth.js           # JWT authentication
�x   �x   �|�w�w scheduleGuard.js  # Schedule access control
�x   �x
�x   �u�w�w services/              # External service integrations
�x   �x   �u�w�w kimiService.js    # Kimi AI service with tier-aware prompts
�x   �x   �|�w�w contentService.js # PDF/DOCX/URL content extraction
�x   �x
�x   �u�w�w models/                # Data models
�x   �x   �|�w�w Task.js           # Task model
�x   �x
�x   �u�w�w db/                    # Database
�x   �x   �|�w�w connection.js     # PostgreSQL connection pool
�x   �x
�x   �u�w�w migrations/            # SQL schema migrations
�x   �x   �u�w�w 001_initial_schema.sql
�x   �x   �u�w�w 002_add_parents.sql
�x   �x   �u�w�w 003_ai.sql
�x   �x   �u�w�w 004_Task.sql
�x   �x   �u�w�w 005_tutor_sessions.sql
�x   �x   �u�w�w 007_procrastination_prophecy.sql
�x   �x   �u�w�w 008_revision_mode.sql
�x   �x   �u�w�w 011_comprehensive_features.sql
�x   �x   �u�w�w 012_fix_role_constraint.sql
�x   �x   �|�w�w 013_ai_media.sql
�x   �x
�x   �|�w�w uploads/               # File upload storage
�x       �|�w�w exercises/
�x
�u�w�w frontend/                  # Main React application
�x   �u�w�w package.json          # Frontend dependencies
�x   �u�w�w tailwind.config.js    # Tailwind theme (pixel game style)
�x   �u�w�w postcss.config.js     # PostCSS configuration
�x   �x
�x   �u�w�w public/               # Static assets
�x   �x
�x   �|�w�w src/
�x       �u�w�w App.js            # React router configuration
�x       �u�w�w index.js          # App entry point
�x       �u�w�w index.css         # Global styles (Press Start 2P font)
�x       �x
�x       �u�w�w components/
�x       �x   �u�w�w auth/         # Login.jsx, Register.jsx
�x       �x   �u�w�w dashboard/    # Dashboard.jsx, CourseCard.jsx
�x       �x   �u�w�w StudyTimer/   # StudyTimer.jsx (Pomodoro timer)
�x       �x   �u�w�w Achievements/ # achievements.jsx, AchievementCard.jsx
�x       �x   �u�w�w tasks/        # tasks.jsx
�x       �x   �u�w�w StudyBuddy/   # StudyBuddy.jsx (AI chat)
�x       �x   �u�w�w AITutor/      # StoryQuestAI.jsx, RevisionMode.jsx
�x       �x   �u�w�w ScheduleGenerator/
�x       �x   �u�w�w ScheduleOptimizer/
�x       �x   �u�w�w Progress/     # ProgressDashboard.jsx
�x       �x   �u�w�w Teacher/      # TeacherDashboard.jsx, TeacherLayout.jsx
�x       �x   �u�w�w Social/       # SocialHub.jsx
�x       �x   �u�w�w ExerciseGenerator/
�x       �x   �u�w�w leaderboard/  # Leaderboard.jsx
�x       �x   �u�w�w profile/      # Profile.jsx
�x       �x   �u�w�w parent/       # ParentDashboard.jsx, LinkStudentPage.jsx
�x       �x   �u�w�w portal/       # ParentPortal.jsx, ConnectParent.jsx
�x       �x   �|�w�w shared/       # Navbar.jsx, PixelButton.jsx, PixelCard.jsx
�x       �x
�x       �|�w�w utils/
�x           �u�w�w auth.js       # Frontend auth utilities
�x           �|�w�w api.js        # Axios API client with interceptors
�x
�u�w�w studyquest-app/            # Additional React app (similar structure)
�u�w�w Doc/                       # Project documentation
�u�w�w Diagram/                   # Architecture diagrams
�u�w�w Diagram2/                  # Additional diagrams
�u�w�w PROJECT_OVERVIEW.md       # Technical project overview
�|�w�w UI_AND_PIXEL_ART_GUIDE.md # Design system and styling guide
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
# Run migrations in order
psql $DATABASE_URL -f migrations/001_initial_schema.sql
psql $DATABASE_URL -f migrations/002_add_parents.sql
# ... continue through all migrations
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
```

**IMPORTANT**: The .env file contains sensitive credentials. Never commit it to git (already in .gitignore).

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| students | User accounts (students, parents, teachers), gamification stats |
| study_sessions | Individual study session records |
| `achievements` | Available achievements/badges definitions |
| `student_achievements` | Unlocked achievements per student |
| daily_goals | Daily study targets and progress |
| `tasks` | User-created tasks with priorities |

### Key Database Features
- **UUID Primary Keys**: All main entities use UUIDs
- **Foreign Key Constraints**: Proper referential integrity with CASCADE deletes
- **Triggers**: Auto-update updated_at timestamps, auto-calculate student stats
- **Views**: student_leaderboard, recent_sessions, hero_journey_summary for analytics

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
| student | Dashboard, Progress, Social, Story Quest, AI Tutor, Tasks |
| teacher | Teacher Dashboard, Class Management, Student Analytics, Session Verification |
| parent | Parent Portal, View Child Progress, Rewards Management, AI Conversation Review |

---

## API Endpoints

### Authentication
- POST /api/auth/register - Register student/parent/teacher
- POST /api/auth/login - Login
- GET /api/auth/me - Get current user
- GET /api/auth/profile - Get full profile

### Study Sessions
- GET /api/sessions/active - Get active session
- POST /api/sessions/start - Start new session
- POST /api/sessions/:id/end - End session

### Tasks
- GET /api/tasks - List tasks
- POST /api/tasks - Create task
- PUT /api/tasks/:id - Update task
- DELETE /api/tasks/:id - Delete task

### AI Features
- POST /api/ai/chat - Chat with Study Buddy
- GET /api/ai/history - Get chat history

### Story Quest
- POST /api/storyquest/intro - Generate story intro
- POST /api/storyquest/learn - Get lesson content

---

## Code Style Guidelines

### JavaScript/React
- Use ES6+ features (async/await, destructuring, arrow functions)
- Component files use PascalCase (e.g., StudyTimer.jsx)
- Utility files use camelCase (e.g., `auth.js`)
- CSS classes follow Tailwind convention

### Backend
- API responses follow pattern: { success: boolean, message?: string, data?: any }
- Error handling with try/catch
- Console logging with emoji prefixes:
  - ??- Success
  - ??- Error
  - ?? - Database/query
  - ?? - Debug/info
  - ?? - API calls

### SQL
- Use uppercase for keywords (CREATE, SELECT, INSERT)
- Use lowercase for identifiers
- Include comments for complex queries
- Always use parameterized queries ($1, $2) to prevent SQL injection

---

## Testing Strategy

### Manual Testing
- API testing via Postman/curl
- Frontend testing via React Testing Library (included in CRA)

### Health Check Endpoints
```bash
# backend health
curl http://localhost:5000/api/health

# Database test
curl http://localhost:5000/api/db/test

# Root API
curl http://localhost:5000/api
```

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
- Model: kimi-k2.5
- Timeout: 60 seconds
- Max tokens: 2000 for chat
- Thinking mode: Enabled for chat

---

*Last updated: March 2026*
