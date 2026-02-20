# StudyQuest - AI Coding Agent Guide

## Project Overview

**StudyQuest** is a gamified study companion application designed for Hong Kong secondary school students. It combines study tracking, gamification mechanics, AI-powered tutoring, and family collaboration features to create an engaging learning ecosystem.

This is a Final Year Project (FYP GP20) for the Higher Diploma in Software Engineering (2025/2026).

### Core Value Proposition
- **Students**: Earn XP, level up, maintain streaks, and compete on leaderboards
- **Parents**: Gain visibility into child's study habits via dedicated dashboard
- **AI Features**: Age-appropriate tutoring with content tailored to Hong Kong curriculum

---

## Technology Stack

### Backend
- **Runtime**: Node.js (Express.js)
- **Database**: PostgreSQL (hosted on Supabase)
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **AI Integration**: Kimi API (Moonshot AI) via OpenAI SDK
- **CORS**: Enabled for cross-origin requests

### Frontend
- **Framework**: React 19+ (Create React App)
- **Routing**: React Router v7
- **Styling**: Tailwind CSS 3.4+
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **Charts**: Recharts
- **HTTP Client**: Axios

### Database
- **Type**: PostgreSQL 15+ (Supabase managed)
- **Connection**: `pg` library with connection pooling
- **SSL**: Required for Supabase connections

---

## Project Structure

```
FYP_GP20/
├── backend/                    # Express.js API server
│   ├── routes/                 # API route handlers
│   │   ├── auth.js            # Authentication (register/login)
│   │   ├── sessions.js        # Study session management
│   │   ├── achievements.js    # Achievement system
│   │   ├── tasks.js           # Task management
│   │   ├── ai.js              # AI tutor endpoints
│   │   ├── aiStory.js         # StoryQuest RPG endpoints
│   │   ├── schedule.js        # Study schedule generator
│   │   ├── tutor.js           # AI tutoring sessions
│   │   ├── family.js          # Parent-child linking
│   │   ├── leaderboard.js     # Leaderboard data
│   │   ├── dashboard.js       # Dashboard analytics
│   │   └── student.js         # Student profile
│   ├── controllers/            # Business logic
│   │   └── aiController.js    # AI orchestration
│   ├── middleware/             # Express middleware
│   │   ├── auth.js            # JWT authentication
│   │   └── scheduleGuard.js   # Schedule access control
│   ├── models/                 # Data models
│   │   └── Task.js            # Task model
│   ├── services/               # External service integrations
│   │   └── kimiService.js     # Kimi AI service
│   ├── db/                     # Database
│   │   └── connection.js      # PostgreSQL connection pool
│   ├── migrations/             # SQL schema migrations
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_parents.sql
│   │   ├── 003_ai.sql
│   │   ├── 004_Task.sql
│   │   ├── 005_tutor_sessions.sql
│   │   └── ...
│   ├── server.js              # Express app entry point
│   └── .env                   # Environment variables
├── frontend/                   # Main React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/          # Login, Register
│   │   │   ├── dashboard/     # Student dashboard
│   │   │   ├── StudyTimer/    # Study timer component
│   │   │   ├── Achievements/  # Achievement display
│   │   │   ├── Tasks/         # Task management UI
│   │   │   ├── StudyBuddy/    # AI chat interface
│   │   │   ├── AITutor/       # StoryQuest AI tutor
│   │   │   ├── ScheduleGenerator/  # Schedule UI
│   │   │   ├── leaderboard/   # Leaderboard
│   │   │   ├── profile/       # User profile
│   │   │   ├── parent/        # Parent dashboard
│   │   │   ├── portal/        # Parent portal
│   │   │   └── shared/        # Navbar, common components
│   │   ├── utils/
│   │   │   └── auth.js        # Frontend auth utilities
│   │   └── App.js             # React router configuration
│   ├── tailwind.config.js     # Tailwind theme (pixel game style)
│   └── package.json
├── studyquest-app/            # Alternative/legacy React app
│   └── ... (similar structure)
└── Doc/                       # Project documentation
    ├── Project Plan.md
    ├── Table_Of_Content.md
    └── ... (reports, presentations)
```

---

## Build and Run Commands

### Backend

```bash
cd backend

# Install dependencies
npm install

# Development (with auto-reload)
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
| `students` | User accounts (students AND parents), gamification stats |
| `study_sessions` | Individual study session records |
| `achievements` | Available achievements/badges definitions |
| `student_achievements` | Unlocked achievements per student |
| `daily_goals` | Daily study targets and progress |
| `tasks` | User-created tasks with priorities |
| `parents` | Parent account information |
| `parent_student_links` | Parent-child relationships |
| `connection_codes` | Temporary codes for family linking |

### AI-Related Tables

| Table | Purpose |
|-------|---------|
| `ai_conversations` | Chat history with Study Buddy |
| `scheduled_sessions` | AI-generated study schedule items |
| `tutor_sessions` | AI tutoring session records |
| `tutor_messages` | Messages within tutoring sessions |

### Key Database Features
- **UUID Primary Keys**: All main entities use UUIDs
- **Foreign Key Constraints**: Proper referential integrity
- **Triggers**: Auto-update `updated_at` timestamps, auto-calculate student stats
- **Views**: `student_leaderboard`, `recent_sessions` for analytics

---

## Authentication System

### JWT Token Structure
```javascript
{
  studentId: UUID,
  email: String,
  username: String,
  role: 'student' | 'parent',
  formLevel: 'P1'-'P6' | 'S1'-'S6' | null,
  ageTier: 'P1-P3' | 'P4-P6' | 'S1-S3' | 'S4-S6' | null
}
```

### Protected Routes
Routes use `authenticateToken` middleware:
```javascript
const { authenticateToken } = require('../middleware/auth');
router.get('/profile', authenticateToken, async (req, res) => { ... });
```

### Frontend Auth Utilities
Located in `frontend/src/utils/auth.js`:
- `setAuth(token, user)` - Store auth data
- `getAuth()` - Retrieve auth data
- `isAuthenticated()` - Check login status
- `logout()` - Clear auth data

---

## Code Style Guidelines

### JavaScript/React
- Use ES6+ features (async/await, destructuring, arrow functions)
- Component files use PascalCase (e.g., `StudyTimer.jsx`)
- Utility files use camelCase (e.g., `auth.js`)
- CSS classes follow Tailwind convention

### Backend
- Route handlers use snake_case for SQL columns
- API responses follow pattern: `{ success: boolean, message?: string, data?: any }`
- Error handling with try/catch, console.error with emoji prefixes (❌, ✅, 📊)

### SQL
- Use uppercase for keywords (CREATE, SELECT, INSERT)
- Use lowercase for identifiers
- Include comments for complex queries
- Always use parameterized queries (`$1, $2`) to prevent SQL injection

---

## Key Features Implementation

### 1. Gamification System
- **XP Calculation**: 1 minute = 1 XP base, bonuses for longer sessions
- **Level System**: XP thresholds for level progression
- **Streaks**: Daily login tracking
- **Achievements**: Tiered badges (bronze, silver, gold, platinum)

### 2. Age-Tier System
Students are categorized by form level:
- `P1-P3` (ages 6-8): Simple English, basic concepts
- `P4-P6` (ages 9-11): Moderate complexity, Hong Kong context
- `S1-S3` (ages 12-14): Academic English, cause-effect reasoning
- `S4-S6` (ages 15-17): DSE-level, technical language

AI content is automatically adjusted based on the student's tier.

### 3. AI Integration (Kimi/Moonshot)
Located in `backend/services/kimiService.js`:
- **Study Buddy**: Chat-based learning assistant
- **StoryQuest**: RPG-style educational game with AI-generated content
- **Schedule Generator**: AI-assisted study planning
- **AI Tutor**: Subject-specific tutoring with session tracking

### 4. Parent Features
- **Child Linking**: Via 6-digit connection codes
- **Dashboard**: View child's study statistics
- **Progress Tracking**: Real-time visibility into study habits

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register student/parent
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get user profile
- `PATCH /api/auth/onboarding` - Set form level

### Study Sessions
- `GET /api/sessions/active` - Get active session
- `POST /api/sessions/start` - Start new session
- `PATCH /api/sessions/:id/end` - End session

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### AI Features
- `POST /api/ai/chat` - Chat with Study Buddy
- `POST /api/ai/story/start` - Start StoryQuest
- `POST /api/ai/story/lesson` - Get lesson content
- `POST /api/schedule/generate` - Generate study schedule

### Family
- `POST /api/family/code` - Generate connection code
- `POST /api/family/connect` - Connect with code
- `GET /api/family/children` - Get linked children

---

## Testing Strategy

### Manual Testing
- API testing via Postman/curl (examples in `login.md`)
- Frontend testing via React Testing Library (included in CRA)

### Test Commands
```bash
# Frontend tests
cd frontend && npm test

# Backend health check
curl http://localhost:5000/api/health

# Database test
curl http://localhost:5000/api/db/test
```

---

## Development Conventions

### Git
- `.env` files are gitignored
- `node_modules/` directories are gitignored
- Migration files should be committed

### Environment Management
- Development: Local PostgreSQL or Supabase
- Production: Supabase (managed PostgreSQL)
- Never expose `JWT_SECRET` or API keys in client code

### Code Organization
- Keep business logic in controllers/services
- Keep route handlers thin (validation + call service)
- Use middleware for cross-cutting concerns (auth, logging)

---

## Security Considerations

1. **Authentication**: JWT tokens expire after 24 hours
2. **Passwords**: Hashed with bcrypt (10 salt rounds)
3. **Database**: SSL required for Supabase connections
4. **CORS**: Configured for frontend origin
5. **SQL Injection**: Prevented via parameterized queries
6. **Input Validation**: Express-validator on all inputs

---

## Common Development Tasks

### Adding a New API Endpoint
1. Create route handler in `backend/routes/`
2. Add route to `backend/server.js`
3. Use `authenticateToken` middleware if protected
4. Return consistent response format

### Adding a New Database Table
1. Create migration file in `backend/migrations/`
2. Run migration manually or via script
3. Update `db.md` documentation

### Adding a New Frontend Component
1. Create component in appropriate `frontend/src/components/` subdirectory
2. Add route to `frontend/src/App.js` if needed
3. Use Tailwind classes for styling
4. Use `lucide-react` for icons

---

## Troubleshooting

### Database Connection Issues
- Check `DATABASE_URL` format
- Ensure SSL is enabled for Supabase
- Verify network access to Supabase

### AI API Issues
- Verify `KIMI_API_KEY` is set
- Check API key hasn't expired
- Monitor API rate limits

### Frontend-Backend Communication
- Ensure CORS is properly configured
- Check that backend is running on correct port
- Verify API URLs in frontend

---

## Team Structure

| Member | Role | Responsibilities |
|--------|------|------------------|
| Cheung King Wa | Frontend Lead | React, UI/UX, PWA, Mobile |
| Wang Wai Shing | Backend Lead | API, Database, Auth, Security |
| Liang Fai Hung | AI Specialist | Groq/Kimi APIs, Data Viz |
| Siu Tsz Kin | QA & Security | Testing, Security audits |

---

## Documentation References

- `Doc/Project Plan.md` - Full project plan
- `Doc/Table_Of_Content.md` - Report structure
- `backend/db.md` - Database schema documentation
- `backend/migrations/*.sql` - Schema evolution
