# StudyQuest Rebuild Specification
## Adaptive Project-Based Learning Module

**Implementation Status**: Phase 1 Complete ✓  
**Last Updated**: March 31, 2026

---

## Implementation Checklist

### Phase 1: Data Layer ✅ COMPLETE
- [x] Database schema (6 core tables)
- [x] RLS policies for Supabase
- [x] API routes (projects, chapters, attempts, boss-battles, artifacts)
- [x] AI service integration (kimiService.js)

### Phase 2: Frontend Context 🔄 IN PROGRESS
- [ ] ProjectContext provider
- [ ] ChapterView with sidebar
- [ ] BossBattleView

### Phase 3: UI Polish 📋 PLANNED
- [ ] Pixel-art theme integration
- [ ] Animations with Framer Motion
- [ ] Mobile responsiveness

---

## New API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | POST | Create project with AI-generated scope |
| `/api/projects` | GET | List user's projects |
| `/api/projects/:id` | GET | Get project with chapters |
| `/api/projects/:id/suggest-next` | POST | AI suggests next chapter/boss |
| `/api/chapters/generate` | POST | Generate single chapter |
| `/api/chapters/:id` | GET | Get chapter with artifacts |
| `/api/chapters/:id/complete` | POST | Mark complete, generate artifact |
| `/api/attempts` | POST | Submit answer, get AI diagnosis |
| `/api/attempts/:id` | GET | Get attempt details |
| `/api/attempts/:id/retry` | POST | Retry with mini-lesson |
| `/api/boss-battles/start` | POST | Initialize boss battle |
| `/api/boss-battles/:id` | GET | Get battle state |
| `/api/boss-battles/:id/stage` | POST | Submit stage solution |
| `/api/boss-battles/:id/retry` | POST | Retry failed stage |
| `/api/artifacts` | GET | List/search artifacts |
| `/api/artifacts/:id` | GET | Get single artifact |
| `/api/artifacts/project/:id` | GET | Get project artifacts (sidebar) |

---

## New AI Functions (kimiService.js)

| Function | Purpose |
|----------|---------|
| `generateProjectScope()` | AI creates project with skill tree |
| `generateChapter()` | Generate one chapter with context |
| `generateQuestions()` | Create practice questions |
| `generateDiagnosis()` | AI analyzes wrong answers |
| `generateKnowledgeArtifact()` | Create cheat sheet from chapter |
| `generateBossBattle()` | Build multi-stage challenge |
| `validateBossStage()` | Check stage solution |

---

---

## 1. Executive Summary

### What We're Building
A **dynamic, project-based learning system** where users build **Knowledge Artifacts** (personalized reference libraries) through iterative chapter completion. The system generates content on-demand, allows open-book assessment, and replaces high-stakes testing with scaffolded mastery verification.

### Core Philosophy
> Learning creates **durable assets** (notes, cheat sheets, solution guides) that compound across sessions, rather than ephemeral XP points.

---

## 2. Architecture Overview

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Tailwind CSS + Framer Motion |
| Backend | Node.js + Express |
| Database | PostgreSQL (Supabase) |
| AI Engine | Kimi K2.5 (Moonshot AI) |
| State Management | React Context + LocalStorage (cache) |
| Real-time | Supabase Realtime (optional) |

### Database Schema (New Tables)

**File**: `backend/db/migrations/studyquest_rebuild.sql`

```sql
-- Projects (Learning paths)
CREATE TABLE user_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- e.g., "Python Fitness Analyzer"
  description TEXT,
  deliverable TEXT NOT NULL, -- "Working dashboard script"
  subject TEXT, -- "Programming", "Math", etc.
  status TEXT DEFAULT 'active',
  current_chapter_id UUID,
  skill_tree JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Chapters (Individual learning units)
CREATE TABLE project_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES user_projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  context TEXT, -- Real-world scenario
  key_points TEXT[], -- Key concepts
  full_lesson TEXT, -- Full lesson content
  why_it_matters TEXT, -- Connect to deliverable
  questions JSONB DEFAULT '[]', -- Practice questions
  referenced_artifact_ids UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'active',
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chapter Attempts (Answer tracking with AI diagnosis)
CREATE TABLE chapter_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID REFERENCES project_chapters(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  question_type TEXT CHECK (...),
  question_index INTEGER DEFAULT 0,
  user_answer TEXT,
  is_correct BOOLEAN,
  ai_diagnosis TEXT, -- What went wrong
  ai_mini_lesson TEXT, -- Targeted explanation
  references_artifact_id UUID REFERENCES knowledge_artifacts(id),
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge Artifacts (User's reference library)
CREATE TABLE knowledge_artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES user_projects(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES project_chapters(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  summary TEXT,
  tags TEXT[],
  times_accessed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Boss Battles (Multi-stage synthesis challenges)
CREATE TABLE boss_battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES user_projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scenario TEXT,
  deliverable TEXT,
  stages JSONB DEFAULT '[]',
  current_stage INTEGER DEFAULT 0,
  failed_stage INTEGER, -- For scaffolded retry
  status TEXT DEFAULT 'active',
  ai_diagnosis TEXT,
  badge_name TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Project Skill Tree (Branching learning paths)
CREATE TABLE project_skill_tree (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES user_projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  prerequisites TEXT[] DEFAULT '{}',
  unlocks TEXT[] DEFAULT '{}',
  is_unlocked BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  estimated_minutes INTEGER DEFAULT 20,
  chapter_id UUID REFERENCES project_chapters(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. User Flow Specification

### 3.1 Entry and Project Creation

```
User Input: "I want to learn Python to analyze fitness data"
    ↓
[System] AI generates PROJECT SCOPE
- Deliverable: "Working fitness dashboard script"
- Skill Tree Preview: CSV Reading → Data Cleaning → Visualization
- Chapter 1 generated immediately
```

### 3.2 Chapter Loop

```
LEARN SCENE
├─ Context: "You need to load Apple Health data"
├─ Key Points (3 bullets)
├─ Full Lesson (structured explanation)
└─ Why It Matters (connects to final deliverable)
    ↓
PRACTICE QUESTION (Open Book)
├─ Sidebar visible: All previous artifacts searchable
├─ Question Type: Code / Fill-blank / Debug / Prediction
├─ User submits answer
    ↓
[IF WRONG]
├─ AI Diagnostic (2-3s): Analyzes error
├─ Highlights specific artifact section
├─ Mini-lesson injection targeting misconception
└─ Retry same question (unlimited, no penalty)
    ↓
[IF CORRECT]
├─ XP + Completion logged
└─ KNOWLEDGE ARTIFACT generated
```

### 3.3 Progression Decision Point

```
Chapter Complete
    ↓
AI Suggests 2 Options:
├─ "Data Cleaning" (logical next prerequisite)
├─ "Boss Battle" (if confidence high)
└─ User free text: "I want to learn Functions instead"
    ↓
[User selects] → Next chapter generates immediately
[User selects Boss] → Battle initiates
```

### 3.4 Boss Battle (Synthesis Verification)

```
MULTI-STAGE CHALLENGE
Example: "Build dashboard from raw data"
├─ Stage 1: Load CSV [Artifact: CSV Cheat Sheet available]
├─ Stage 2: Clean Data [Artifact: Cleaning Guide available]  
└─ Stage 3: Visualize [Artifact: Matplotlib Notes available]

MECHANICS:
├─ Open book: All artifacts visible in sidebar
├─ Staged: Must complete Stage 1 to unlock Stage 2
├─ Scaffolded Retry: 
│   ├─ Fail Stage 2 → AI diagnoses specific error
│   ├─ System highlights relevant artifact section
│   └─ Retry Stage 2 only (Stage 1 stays completed)
└─ Animation: Assembly line showing artifacts combining

VICTORY:
├─ "Dashboard Mastery" badge earned
├─ Final artifact added to permanent library
└─ Project marked complete
```

---

## 4. Key UI Components

### 4.1 Open Book Sidebar
- Full-text search across all artifacts
- Highlight relevant section during diagnostic
- Collapsible sections
- Pin frequently used artifacts

### 4.2 Diagnostic Overlay
- AI analysis of error
- Relevant artifact section quote
- Mini-lesson injection
- Retry button

### 4.3 Boss Battle Stage UI
- Stage progression bar
- Scenario description
- Task definition
- Code editor (if applicable)
- Artifact sidebar toggle

---

## 5. AI Prompt Engineering

### 5.1 Project Scope Generation
```
INPUT: User wants to learn {TOPIC} for {GOAL}

OUTPUT: {
  title: "Project title",
  deliverable: "Specific end product",
  skillTree: [...],
  firstChapter: {...}
}
```

### 5.2 Chapter Content Generation
```
OUTPUT FORMAT:
KEY POINTS:
• [3-5 key concepts]

FULL LESSON:
[Detailed explanation]

WHY IT MATTERS:
[Real-world application]

KNOWLEDGE ARTIFACT:
{
  title: "Cheat sheet name",
  content: "Markdown reference",
  tags: [...]
}
```

### 5.3 Diagnostic Feedback
```
INPUT: Question, User answer, Correct answer

OUTPUT: {
  diagnosis: "Error explanation",
  misconception: "Error type label",
  relevantArtifactSection: {...},
  miniLesson: "Targeted explanation",
  hint: "Subtle hint"
}
```

---

## 6. API Endpoints

```
# Projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id/progress

# Chapters
POST   /api/chapters/generate
GET    /api/chapters/:id
POST   /api/chapters/:id/complete

# Questions
POST   /api/questions/:id/attempt
GET    /api/questions/:id/diagnosis

# Artifacts
GET    /api/artifacts
GET    /api/artifacts/search

# Boss Battles
POST   /api/boss-battles/initiate
POST   /api/boss-battles/:id/stage/:n
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Database schema migration
- Project creation flow
- Basic chapter generation

### Phase 2: Learning Loop (Week 3-4)
- Learn scene UI
- Question attempt system
- Diagnostic feedback

### Phase 3: Open Book (Week 5-6)
- Artifact sidebar
- Full-text search
- Artifact highlighting

### Phase 4: Progression (Week 7-8)
- AI suggestions
- Skill tree visualization
- Free text selection

### Phase 5: Boss Battles (Week 9-10)
- Multi-stage system
- Staged retry
- Victory animations

### Phase 6: Polish (Week 11-12)
- Offline support
- Performance optimization
- Testing

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Chapter Completion Rate | > 80% |
| Boss Battle Pass Rate | > 60% |
| Average Retry Count | < 2 |
| Artifact Reference Rate | > 70% |
| Session Return Rate | > 50% |
| Time to Complete | 2-4 hours |

---

## 9. Comparison: Old vs New

| Aspect | StoryQuest (Old) | StudyQuest Rebuild (New) |
|--------|------------------|--------------------------|
| Structure | Static 4 chapters | Dynamic single-chapter |
| Theme | Fantasy RPG | Project-based real deliverables |
| Progress | Session-only | PostgreSQL persistence |
| Questions | Multiple choice only | Code, fill-blank, error analysis |
| Testing | Closed-book | Open-book with artifact sidebar |
| Boss Battle | Forced Chapter 4 | User-initiated when ready |
| Failure | Retry from start | Scaffolded retry with diagnosis |
| AI Generation | Full roadmap upfront | One chapter at a time |
| Feedback | Generic | Diagnostic with artifact reference |
| Output | XP points | Knowledge Artifacts (durable) |

---

*Specification Version: 1.0*
*StudyQuest Rebuild - Adaptive Project-Based Learning*
