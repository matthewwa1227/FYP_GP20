# StudyQuest - Project Scheme for Google Stitch
## AI-Powered Gamified Learning Platform for HK Students

---

## 1. PROJECT OVERVIEW

**Project Name:** StudyQuest  
**Tagline:** "Transform studying into an epic RPG adventure"  
**Type:** Web Application (Responsive - Desktop, Tablet, Mobile)  
**Target Market:** Hong Kong Secondary School Students (F.1 - F.6, ages 12-18)

### Core Concept
StudyQuest combines study tracking, AI tutoring, and RPG gamification to motivate students. Students earn XP, level up, maintain streaks, and battle the "Shadow of Doom" (procrastination) through an immersive game narrative.

### Value Proposition
- **For Students:** Make studying addictive through game mechanics
- **For Parents:** Monitor child's study habits via Parent Portal
- **For Teachers:** Track class progress and create challenges

---

## 2. TARGET USERS

### Primary User: Student (Ages 12-18)
- **F.1-F.3 (Junior):** Need simple language, basic features
- **F.4-F.6 (Senior):** DSE preparation focus, advanced AI tutoring
- **Persona:** "Alex" - F.5 student struggling with motivation, loves mobile games

### Secondary User: Parent
- Wants visibility into child's study time
- Concerned about screen time balance
- Needs simple, non-technical interface

### Tertiary User: Teacher
- Manages classes of 30-40 students
- Creates assignments and challenges
- Tracks analytics for intervention

---

## 3. TECHNICAL ARCHITECTURE

### Frontend Stack
- React 19+
- React Router DOM
- Tailwind CSS
- Axios for API calls
- (UI Library to be designed by Stitch)

### Backend Stack
- Node.js + Express
- PostgreSQL (Supabase)
- JWT Authentication
- REST API

### AI Integration
- Moonshot AI (Kimi K2.5)
- Context-aware tutoring by age tier
- Subject: Math, Physics, Chemistry, Biology, History, English

### Deployment
- Frontend: Vercel
- Backend: Render
- Database: Supabase

---

## 4. USER ROLES & PERMISSIONS

| Role | Capabilities |
|------|-------------|
| **Student** | Study timer, AI tutor, quests, social, progress tracking |
| **Parent** | View child stats, set rewards, review AI conversations |
| **Teacher** | Create class challenges, view analytics, verify sessions |

---

## 5. CORE MODULES

### Module A: Authentication & Onboarding
**Purpose:** User registration, login, role selection

**Features:**
- Email/password registration
- Role selection (Student/Parent/Teacher)
- Form level selection (F.1 - F.6)
- Age-appropriate onboarding flow

**User Flow:**
1. Landing page → Register/Login
2. Select role
3. If Student: Select form level, subjects of interest
4. If Parent: Generate linking code
5. If Teacher: School verification

---

### Module B: Hero's Hub (Student Dashboard)
**Purpose:** Main landing page, motivation center, progress overview

**Data Points to Display:**
- Current level and XP progress
- Shadow of Doom percentage (procrastination metric)
- Current streak count
- Today's study time
- Active quests/tasks
- Recent achievements
- Guild/leaderboard rank

**Key Interactions:**
- Start study session (navigates to timer)
- View daily quests
- Check progress stats
- Access AI tutor

**Gamification Elements:**
- XP system (1 min = 1 XP base)
- Level progression (exponential curve)
- Streak mechanics (daily login bonus)
- Hero Power (affected by streaks)
- Shadow of Doom (grows when missing study days)

---

### Module C: Chamber of Focus (Study Timer)
**Purpose:** Pomodoro-style study session tracking

**Core Functionality:**
- Start/stop study sessions
- Subject/topic selection
- Timer display (25-min Pomodoro default)
- Session categorization
- Real-time XP earning
- Session validation (anti-cheating)

**Session States:**
- IDLE: Ready to start
- ACTIVE: Timer running
- PAUSED: Break time
- COMPLETED: Session ended, XP awarded

**Data Captured:**
- Start time, end time, duration
- Subject, topic
- XP earned
- Device ID (for concurrent access prevention)

---

### Module D: Quest Log (Task Management)
**Purpose:** Daily tasks, assignments, challenges

**Task Types:**
- Daily bounties (auto-generated daily)
- Teacher assignments
- Self-created tasks
- Challenge tasks (competitive)

**Task Properties:**
- Title, description
- XP reward
- Due date
- Priority (Low/Medium/High)
- Status (Pending/In Progress/Completed)
- Category/Subject

**Interactions:**
- Create new task
- Mark complete
- View task details
- Filter by status/priority

---

### Module E: Tome of Knowledge (AI Tutor)
**Purpose:** AI-powered study assistance

**Two Modes:**

**1. Study Buddy Chat:**
- Free-form Q&A
- Homework help
- Concept explanations
- Context-aware by subject

**2. Story Quest RPG:**
- Narrative-driven learning
- User chooses adventure path
- AI generates story + quiz questions
- Boss battles at chapter ends

**AI Features:**
- Age-appropriate language (simpler for F.1-F.3)
- Hong Kong curriculum alignment
- Media support (image analysis)
- Conversation history

---

### Module F: Progress & Analytics
**Purpose:** Detailed study statistics and insights

**Data Visualizations Needed:**
- Weekly study time chart
- Subject distribution pie chart
- XP growth over time
- Streak calendar (GitHub-style heatmap)
- Skill tree progression
- Comparison to class average

**Reports:**
- Weekly summary
- Monthly progress report
- Subject mastery levels
- Time of day productivity patterns

---

### Module G: Social & Guild
**Purpose:** Peer motivation and competition

**Features:**
- Friend system (add/remove friends)
- Study groups (create/join/leave)
- Leaderboards (global, friends, class)
- Challenges (1v1, group competitions)
- Activity feed (friend achievements)

**Leaderboard Categories:**
- Weekly XP
- Monthly XP
- All-time XP
- Subject-specific
- Streak length

---

### Module H: Parent Portal
**Purpose:** Parent visibility and control

**Features:**
- Link to child's account (via code)
- View child's study stats
- See AI conversation history
- Set rewards for achievements
- Set daily time limits
- Receive weekly progress emails

**Views:**
- Overview dashboard (child selector if multiple)
- Study activity timeline
- AI chat review (safety feature)
- Reward management

---

### Module I: Teacher Console
**Purpose:** Classroom management

**Features:**
- Class roster management
- Create challenges/assignments
- View class analytics
- Verify study sessions
- Send announcements
- Identify at-risk students

**Analytics:**
- Class average study time
- Completion rates
- Subject performance breakdown
- Individual student reports

---

## 6. PAGE REQUIREMENTS

### Public Pages
| Page | Purpose | Key Elements |
|------|---------|--------------|
| Landing | Marketing, conversion | Hero section, feature list, testimonials, CTA buttons |
| Login | Authentication | Email, password, forgot password, social login options |
| Register | Account creation | Role selector, email verification, terms acceptance |
| Onboarding | Setup wizard | Form level, subjects, avatar selection (optional) |

### Student Pages
| Page | Purpose | Data Needed |
|------|---------|-------------|
| Dashboard (Hero's Hub) | Main landing | User stats, quests, progress, quick actions |
| Study Timer | Focus mode | Active timer, subject selector, session controls |
| Tasks (Quest Log) | Task management | Task list, filters, create/edit forms |
| AI Tutor | AI assistance | Chat interface, history, media upload |
| Story Quest | RPG learning | Story narrative, choices, quiz questions |
| Progress | Analytics | Charts, stats, skill tree, streak calendar |
| Leaderboard | Rankings | User rankings, filters, friend comparisons |
| Social Hub | Community | Friend list, groups, challenges, feed |
| Profile | Settings | Avatar, username, preferences, connected accounts |
| Achievements | Badge collection | Unlocked/locked badges, progress |
| Revision Mode | Document study | Upload, flashcards, document chat |

### Parent Pages
| Page | Purpose | Data Needed |
|------|---------|-------------|
| Parent Dashboard | Overview | Linked children, summary stats |
| Link Student | Connect to child | Code entry, QR scanner |
| Child Detail | Individual view | Study timeline, AI conversations, rewards |
| Reward Management | Incentives | Create rewards, set XP targets |
| Settings | Preferences | Notification settings, time limits |

### Teacher Pages
| Page | Purpose | Data Needed |
|------|---------|-------------|
| Teacher Dashboard | Overview | Class list, quick stats, alerts |
| Class Management | Roster | Student list, add/remove, groups |
| Challenge Creator | Assignments | Form to create challenges, assign to classes |
| Analytics | Reports | Class performance, individual reports |
| Session Verification | Anti-cheat | Review suspicious sessions |

---

## 7. GAMIFICATION SYSTEM

### XP System
- Base: 1 XP per minute studied
- Streak bonus: +10% per streak day (max 50%)
- Subject mastery bonus: +20% for weak subjects
- Daily goal completion: +100 XP flat

### Level Progression
- Formula: `nextLevelXP = level * 1250`
- Max level: 50 (soft cap)
- Level titles: Novice → Apprentice → Scholar → Adept → Mage → Archmage → Sage

### Streak Mechanics
- Daily login required
- Study at least 15 minutes to maintain
- Streak freeze (1 per week, consumable item)
- Streak milestones: 7, 30, 100, 365 days

### Achievement System
**Categories:**
- Study Habits (total time, sessions)
- Consistency (streaks, daily goals)
- Social (friends, challenges won)
- Mastery (subject expertise)
- Special Events (holiday events)

**Rarity Tiers:**
- Common (Bronze)
- Uncommon (Silver)
- Rare (Gold)
- Epic (Platinum)
- Legendary (Animated/Dynamic)

### The Shadow of Doom
**Concept:** Procrastination visualization
- Grows when missing study days
- Shrinks when completing daily goals
- At 50%: Warning notifications
- At 80%: "Boss Battle" required (special study session)
- At 100%: Streak reset, XP penalty

---

## 8. AI INTEGRATION SPECIFICATIONS

### Study Buddy AI (Kimi K2.5)

**Age-Tier Prompt Engineering:**
```
F.1-F.3: Simple English, 5-8 word sentences, emojis, concrete examples
F.4-F.6: Standard English, academic terminology allowed, abstract concepts OK
```

**Capabilities:**
- Answer subject questions
- Explain homework problems
- Generate practice questions
- Summarize concepts
- Check written work
- Image analysis (uploaded problems)

**Safety Guardrails:**
- No direct answers to test questions
- Encouragement over criticism
- Study technique suggestions
- Break reminders

### Story Quest AI

**Narrative Structure:**
- Introduction: Set scene, establish goal
- Learning Phase: Present content in story context
- Challenge: Quiz question (multiple choice)
- Branching: Correct answer → progress, Wrong → hint → retry
- Boss Battle: 5 questions, timed

**Story Settings:**
- Kingdom of Calculus (Math)
- Physics Fortress (Physics)
- Bio-Dome (Biology)
- Chem-Lab Ruins (Chemistry)
- History Timeline (History)

---

## 9. DATA MODELS (Simplified)

### User (Students, Parents, Teachers)
- id, email, password_hash, role
- username, avatar_url, level, xp
- current_streak, longest_streak
- form_level, age_tier
- shadow_level, hero_power
- created_at, last_active

### Study Session
- id, student_id, subject, topic
- started_at, ended_at, duration_minutes
- xp_earned, status (active/completed)
- device_id, is_verified

### Task
- id, student_id, title, description
- subject, xp_reward, priority
- due_date, status, created_by (system/teacher/self)

### Achievement
- id, code, title, description, icon
- category, rarity, xp_bonus, criteria

### UserAchievement
- user_id, achievement_id, unlocked_at

### Friend/Relationship
- requester_id, addressee_id, status
- created_at

### Study Group
- id, name, description, created_by
- member_count, subject_focus

### ParentLink
- parent_id, student_id, relationship
- linked_at, status

---

## 10. USER FLOWS

### Flow 1: First-Time Student
1. Register account
2. Select form level (F.1-F.6)
3. Choose subjects of interest
4. Tutorial: "How StudyQuest Works"
5. Dashboard tour
6. Start first study session
7. Earn first achievement

### Flow 2: Daily Study Routine
1. Open app → Dashboard
2. Check daily quests
3. Start study timer
4. Select subject/topic
5. Complete 25-min session
6. XP awarded, progress updated
7. (Optional) Use AI tutor for help
8. Log off

### Flow 3: Parent Setup
1. Register as parent
2. Generate linking code
3. Give code to child
4. Child accepts link
5. Parent sees child dashboard
6. Set up reward for goal

### Flow 4: Challenge Creation (Teacher)
1. Create class group
2. Add students (invite codes)
3. Create challenge
4. Set XP reward, deadline
5. Students complete challenge
6. View leaderboard/results

---

## 11. NOTIFICATIONS

### Push Notifications
- Daily reminder (customizable time)
- Streak at risk warning
- Achievement unlocked
- Friend request
- Challenge invitation
- Parent reward available

### Email Notifications
- Weekly progress report (parent)
- Weekly summary (student)
- Streak milestone celebration
- Account security alerts

---

## 12. ACCESSIBILITY REQUIREMENTS

- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Color contrast minimum 4.5:1
- Font scaling support (up to 200%)
- Reduced motion option

---

## 13. PERFORMANCE REQUIREMENTS

- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- API response time: < 500ms
- 60fps animations
- Works on 3G networks
- Offline mode for timer (sync when online)

---

## 14. SECURITY REQUIREMENTS

- HTTPS only
- JWT token expiration: 24 hours
- Rate limiting on API
- SQL injection prevention
- XSS protection
- Content Security Policy
- GDPR compliance (data export/deletion)

---

## 15. INTEGRATION POINTS

### External APIs
- Moonshot AI (Kimi)
- Supabase Auth (optional)
- Email service (SendGrid/AWS SES)
- Push notification service

### File Uploads
- Avatar images (JPG/PNG, max 2MB)
- Document uploads for Revision Mode (PDF/DOCX)
- Image uploads for AI analysis (JPG/PNG)

---

## 16. FUTURE ENHANCEMENTS (Post-MVP)

- Mobile native app (React Native)
- Offline study mode
- Advanced analytics (ML predictions)
- Virtual study rooms (WebRTC)
- School-wide competitions
- AI-generated personalized study plans
- Integration with HK Education Bureau resources
- AR learning experiences

---

## 17. DESIGN PRINCIPLES (For Stitch Reference)

### Brand Personality
- **Tone:** Encouraging, adventurous, playful but focused
- **Voice:** "Your study companion," "Level up your learning"
- **Emotion:** Motivating, rewarding, community-driven

### User Psychology
- Use progress bars to show advancement
- Celebrate small wins (micro-achievements)
- Create FOMO with streaks and limited events
- Social proof via leaderboards
- Loss aversion with Shadow of Doom mechanic

### Cultural Context (Hong Kong)
- DSE (Diploma of Secondary Education) references
- Local school system terminology (F.1-F.6)
- Hong Kong public holidays
- Cantonese/English bilingual support (future)
- Local academic calendar

---

## END OF DOCUMENT

**Prepared for:** Google Stitch UI Design Team  
**Project:** StudyQuest FYP GP20  
**Date:** March 2026  
**Contact:** [Student Name], Higher Diploma in Software Engineering

---

**Notes for Stitch:**
- This document contains functional requirements only
- All UI/UX design decisions are left to Stitch's expertise
- Pixel-art RPG theme is preferred but not mandatory
- Dark mode preferred (study apps used in evenings)
- Mobile-first responsive design required
- Gamification elements should feel rewarding, not childish for F.4-F.6 users
