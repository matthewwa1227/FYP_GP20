# StudyQuest - Project Overview

## 📋 Project Summary
**StudyQuest** is a gamified learning platform for HK students featuring RPG elements, AI tutoring, progress tracking, and social learning.

**Tech Stack:**
- **Frontend:** React, Tailwind CSS, Framer Motion
- **Backend:** Node.js, Express, PostgreSQL
- **AI:** Kimi K2.5 (Moonshot AI)
- **Auth:** JWT tokens

---

## 🗂️ Project Structure

### Root Directory
```
FYP_GP20/
├── backend/          # Node.js API server
├── frontend/         # React SPA
├── Diagram/          # Architecture diagrams
├── Diagram2/         # Additional diagrams
├── Doc/              # Documentation
└── studyquest-app/   # (Additional app files)
```

---

## 🔧 Backend Structure (`/backend`)

### Entry Point
| File | Purpose |
|------|---------|
| `server.js` | Express app entry point, route registration, server startup |

### Database (`/db`)
| File | Purpose |
|------|---------|
| `connection.js` | PostgreSQL pool configuration, query helper functions |

### Routes (`/routes`) - API Endpoints
| File | Purpose | Key Endpoints |
|------|---------|---------------|
| `auth.js` | User authentication | POST /register, POST /login, JWT handling |
| `student.js` | Student profile & stats | GET /profile, PUT /profile, GET /stats, GET /schedule |
| `sessions.js` | Study session tracking | POST /start, POST /end, GET /active, GET /history |
| `tasks.js` | Task management | CRUD for student tasks |
| `achievements.js` | Achievement system | GET /, unlock achievements |
| `leaderboard.js` | Global rankings | GET /global, GET /weekly |
| `dashboard.js` | Dashboard analytics | GET /stats, study summaries |
| `family.js` | Parent-student linking | Family connections management |
| `ai.js` | AI tutor chat | POST /chat, Study Buddy integration |
| `aiStory.js` | Story Quest AI | Schedule generation, question generation |
| `storyquest.js` | Story Quest RPG | Scene generation, lesson content |
| `tutor.js` | AI tutoring sessions | Session management |
| `schedule.js` | Study schedules | Weekly schedule generation |
| `scheduleOptimizer.js` | AI-optimized schedules | POST /generate, GET /adherence |
| `revision.js` | Document-based learning | Upload docs, generate quizzes |
| `progress.js` | Progress tracking | GET /dashboard, POST /goals |
| `rewards.js` | Parent-teacher rewards | Reward definitions, assignments |
| `aiConversations.js` | AI chat review | Conversation logging, flagging |
| `teacher.js` | Teacher module | Class management, analytics, verifications |
| `social.js` | Social features | Groups, friends, challenges |

### Controllers (`/controllers`)
| File | Purpose |
|------|---------|
| `aiController.js` | AI service integration logic |
| `revisionController.js` | Document processing logic |

### Middleware (`/middleware`)
| File | Purpose |
|------|---------|
| `auth.js` | JWT verification middleware |
| `scheduleGuard.js` | Schedule-based access control |

### Services (`/services`)
| File | Purpose |
|------|---------|
| `kimiService.js` | Kimi AI API integration with thinking mode |
| `contentService.js` | Content extraction (PDF, DOCX, URLs) |

### Models (`/models`)
| File | Purpose |
|------|---------|
| `Task.js` | Task data model |

---

## 🎨 Frontend Structure (`/frontend/src`)

### Entry Points
| File | Purpose |
|------|---------|
| `App.js` | React Router configuration, route definitions |
| `index.js` | React app entry, root render |

### Components (`/components`)

#### Auth (`/auth`)
| File | Purpose |
|------|---------|
| `Login.jsx` | User login form |
| `Register.jsx` | User registration with role selection |

#### Dashboard (`/dashboard`)
| File | Purpose |
|------|---------|
| `Dashboard.jsx` | Main student dashboard, stats, quick actions |
| `CourseCard.jsx` | Course display component |

#### AI Tutor (`/AITutor`)
| File | Purpose |
|------|---------|
| `StoryQuestAI.jsx` | RPG learning game (Story Quest) |
| `StudyJourney.jsx` | Learning path visualization |
| `RevisionMode.jsx` | Document upload & quiz mode |

#### Progress (`/Progress`)
| File | Purpose |
|------|---------|
| `ProgressDashboard.jsx` | Goals, stats, progress tracking |

#### Teacher (`/Teacher`)
| File | Purpose |
|------|---------|
| `TeacherDashboard.jsx` | Teacher dashboard, class management |
| `TeacherLayout.jsx` | Teacher-specific layout wrapper |

#### Social (`/Social`)
| File | Purpose |
|------|---------|
| `SocialHub.jsx` | Study groups, friends, challenges |

#### Parent (`/parent`, `/portal`)
| File | Purpose |
|------|---------|
| `ParentDashboard.jsx` | Parent view of linked students |
| `ParentPortal.jsx` | Parent management interface |
| `ConnectParent.jsx` | Link parent to student |
| `FamilyPortal.jsx` | Family connection management |

#### Study Tools
| File | Purpose |
|------|---------|
| `StudyTimer/StudyTimer.jsx` | Pomodoro timer |
| `ScheduleGenerator/ScheduleGenerator.jsx` | AI schedule generator |
| `StudyBuddy/StudyBuddy.jsx` | AI chat interface |
| `Tasks/Tasks.jsx` | Task management |

#### Gamification
| File | Purpose |
|------|---------|
| `Achievements/Achievements.jsx` | Achievement list |
| `Achievements/AchievementCard.jsx` | Individual achievement display |
| `Achievements/AchievementNotification.jsx` | Unlock notifications |
| `leaderboard/Leaderboard.jsx` | Global rankings |

#### Profile & Settings
| File | Purpose |
|------|---------|
| `profile/Profile.jsx` | User profile, settings |
| `GuardianManagement.jsx` | Guardian management |
| `FamilyConnectionManager.jsx` | Family link management |
| `parent/LinkStudentPage.jsx` | Link to student account |

#### Shared (`/shared`)
| File | Purpose |
|------|---------|
| `Navbar.jsx` | Main navigation |
| `PixelButton.jsx` | Pixel-styled button component |
| `PixelCard.jsx` | Pixel-styled card component |
| `ProgressBar.jsx` | Progress indicator |
| `StatCard.jsx` | Statistics display card |

### Utils (`/utils`)
| File | Purpose |
|------|---------|
| `api.js` | Axios config, API client functions |
| `auth.js` | JWT handling, login/logout, getUser |

---

## 🗄️ Database Migrations (`/migrations`)

| File | Purpose |
|------|---------|
| `001_initial_schema.sql` | Core tables: students, sessions, achievements |
| `002_add_parents.sql` | Parent-student relationship tables |
| `003_ai.sql` | AI conversation tables |
| `004_Task.sql` | Task management tables |
| `005_tutor_sessions.sql` | AI tutoring session tables |
| `006_TutorUpdate.sql` | Tutor table updates |
| `007.sql` | Additional features |
| `007_procrastination_prophecy.sql` | Hero/Shadow gamification |
| `008.sql` | Student schedules |
| `008_revision_mode.sql` | Document revision tables |
| `009.sql` | Learning schedules |
| `010.sql` | Additional updates |
| `011_comprehensive_features.sql` | Goals, rewards, analytics, groups, challenges |
| `012_fix_role_constraint.sql` | Add 'teacher' to role constraint |

---

## 🔑 Key Features & Their Files

### 1. Authentication System
- **Backend:** `routes/auth.js`
- **Frontend:** `components/auth/Login.jsx`, `Register.jsx`
- **Utils:** `utils/auth.js`

### 2. Gamification (Hero/Shadow)
- **Backend:** `services/kimiService.js` (NARRATIVE_CONTEXT)
- **Frontend:** `components/dashboard/Dashboard.jsx` (Hero Status display)
- **DB:** `007_procrastination_prophecy.sql`

### 3. Story Quest RPG
- **Backend:** `routes/storyquest.js`, `routes/aiStory.js`
- **Frontend:** `components/AITutor/StoryQuestAI.jsx`
- **Flow:** Schedule → Map → Story → Learn → Battle → Victory

### 4. AI Tutor (Study Buddy)
- **Backend:** `services/kimiService.js` (chatWithStudyBuddy)
- **Frontend:** `components/StudyBuddy/StudyBuddy.jsx`
- **Features:** Socratic method, hint system, document context

### 5. Progress Tracking
- **Backend:** `routes/progress.js`
- **Frontend:** `components/Progress/ProgressDashboard.jsx`
- **DB:** `011_comprehensive_features.sql` (student_goals, progress_tracking)

### 6. Teacher Module
- **Backend:** `routes/teacher.js`
- **Frontend:** `components/Teacher/TeacherDashboard.jsx`, `TeacherLayout.jsx`
- **Features:** Class creation, student management, analytics

### 7. Social Features
- **Backend:** `routes/social.js`
- **Frontend:** `components/Social/SocialHub.jsx`
- **Features:** Study groups, friends, challenges

### 8. Rewards System
- **Backend:** `routes/rewards.js`
- **DB:** `011_comprehensive_features.sql` (reward_definitions, student_rewards)

### 9. AI Conversation Review
- **Backend:** `routes/aiConversations.js`
- **DB:** `011_comprehensive_features.sql` (ai_conversations)

### 10. Schedule Optimizer
- **Backend:** `routes/scheduleOptimizer.js`
- **DB:** `011_comprehensive_features.sql` (optimized_schedules)

---

## 🚀 How to Start

### Backend
```bash
cd backend
npm install
# Set up .env with DATABASE_URL and KIMI_API_KEY
npm start
# Server runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm start
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

## 📡 API Base URLs

- **Development:** `http://localhost:5000`
- **API Prefix:** `/api`
- **Full Example:** `http://localhost:5000/api/auth/register`

---

## 🎭 User Roles

| Role | Access |
|------|--------|
| `student` | Dashboard, Progress, Social, Story Quest, AI Tutor |
| `teacher` | Teacher Dashboard, Class Management, Student Analytics |
| `parent` | Parent Portal, View Child Progress, Rewards Management |

---

## 🔐 Environment Variables (Backend `.env`)

```env
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your_secret_key
KIMI_API_KEY=your_moonshot_api_key
PORT=5000
```

---

## 📦 Key Dependencies

### Backend
- `express` - Web framework
- `pg` - PostgreSQL client
- `jsonwebtoken` - JWT authentication
- `bcryptjs` - Password hashing
- `openai` - Kimi AI integration
- `cors` - Cross-origin requests

### Frontend
- `react` - UI library
- `react-router-dom` - Routing
- `axios` - HTTP client
- `framer-motion` - Animations
- `lucide-react` - Icons
- `tailwindcss` - Styling

---

## 🎯 Main User Flows

### Student Flow
```
Register/Login → Dashboard → 
  ├─ Study Timer → Earn XP
  ├─ Story Quest → RPG Learning
  ├─ Progress → Track Goals
  ├─ Social → Groups & Challenges
  └─ AI Tutor → Get Help
```

### Teacher Flow
```
Register (as teacher) → Teacher Dashboard →
  ├─ Create Class → Get Class Code
  ├─ View Students → Track Progress
  ├─ Create Challenges
  └─ Verify Sessions
```

### Parent Flow
```
Register (as parent) → Parent Portal →
  ├─ Link to Student
  ├─ View Progress
  ├─ Set Rewards
  └─ Review AI Conversations
```

---

*Generated for StudyQuest FYP Project*
