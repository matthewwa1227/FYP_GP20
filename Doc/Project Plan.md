# Project Plan: StudyQuest
**Higher Diploma in Software Engineering – Final Year Project (2025/2026)**

## 1. Project Overview

**StudyQuest** is a cross-platform Progressive Web Application (PWA) designed to transform the secondary school study experience. It addresses the lack of student motivation and the "information gap" parents face regarding their child's education.

By combining **gamification mechanics**, **family collaboration tools**, and **AI-driven personalization**, StudyQuest creates a sustainable study ecosystem. Unlike competitors that focus solely on time-tracking or content delivery, StudyQuest integrates behavioral analytics with social accountability and parental support.

### 1.1 Problem Statement
*   **Students:** Struggle with consistency due to delayed gratification and isolation.
*   **Parents:** Lack visibility into study habits, leading to "nagging" rather than support.
*   **Current Market:** Existing apps are either boring (timers) or shallow (games without insights).

### 1.2 Solution
An intelligent study companion where:
1.  **Students** earn rewards and compete socially.
2.  **Parents** gain real-time visibility and offer tangible rewards.
3.  **AI** optimizes schedules and provides instant tutoring.

---

## 2. Technical Architecture

### 2.1 Technology Stack
| Component | Technology | Justification |
| :--- | :--- | :--- |
| **Frontend** | React.js 18+ | Component-based UI, high performance. |
| **Styling** | Tailwind CSS | Rapid, responsive design for mobile-first UI. |
| **Platform** | PWA (Progressive Web App) | Installable on iOS/Android, offline support, single codebase. |
| **Backend** | Node.js + Express | Scalable REST API, unified JavaScript stack. |
| **Database** | PostgreSQL | Relational data integrity for complex user/social links. |
| **Auth** | JWT (JSON Web Tokens) | Secure, stateless authentication. |
| **Hosting** | Vercel (FE) / Railway (BE) | CI/CD integration, scalable free tiers. |

### 2.2 AI & Data Strategy
To balance cost, performance, and intelligence, the system uses a hybrid approach:

**A. "True" AI Features (External APIs)**
*   **Chatbot Assistant:** Uses **Groq API** (Llama-3 model) for fast, natural language tutoring.
*   **Schedule Optimizer:** Uses **DeepSeek API** (Reasoning model) to analyze complex history and generate weekly schedules.

**B. "Smart" Analytics (Internal Logic)**
*   *Note: These do not use external AI to save costs and latency.*
*   **Pattern Analysis:** SQL queries identify peak productivity hours.
*   **Subject Recommendations:** Ranking algorithms flag neglected subjects.
*   **Streak Predictions:** Conditional logic alerts users if a streak is at risk based on time of day.

---

## 3. Feature Specification & Phasing

Development follows an Agile methodology with 2-week sprints. Features are prioritized into **Core (MVP)** and **Advanced (Phase 2)**.

### Phase 1: Core Foundation (Sep 2025 – Jan 2026)
*Focus: Individual utility and basic parent loop.*

**1. Student Module**
*   **Study Timer:** Start/Stop/Pause with subject selection.
*   **Gamification Engine:** 1 minute = 1 point. Leveling system (XP).
*   **Basic Dashboard:** Daily/Weekly time visualization.
*   **Basic Badges:** "First Session", "7-Day Streak", "Subject Master".

**2. Parent Module**
*   **Child Linking:** Connect via unique code.
*   **Progress Dashboard:** View total study time and subject breakdown.
*   **Goal Setting:** Set simple time-based goals (e.g., "Study 5 hours this week").

**3. System Core**
*   **Authentication:** Registration/Login for Student/Parent roles.
*   **Database:** User profiles, session logs, parent-child relationships.

### Phase 2: Social, AI & Engagement (Feb 2026 – Mar 2026)
*Focus: Retention, personalization, and community.*

**1. Social & Privacy System**
*   **Privacy Tiers:**
    *   *Private:* Visible only to self.
    *   *Friends Only:* Visible on friends leaderboard.
    *   *Public:* Global leaderboard participation.
*   **Study Groups:** Create teams, group goals, and internal leaderboards.

**2. AI Integration**
*   **Chatbot:** "Study Buddy" for motivation and Q&A.
*   **Schedule Optimizer:** One-click generation of personalized study plans.

**3. Advanced Parent Features**
*   **Reward Marketplace:** Parents create custom rewards (e.g., "Movie Night" = 500 points).
*   **Verification:** Parents approve reward redemptions.

**4. Teacher Module (Optional/Stretch)**
*   **Class View:** Aggregate statistics for connected students.
*   **Class Challenges:** Teacher-created goals for the whole class.

---

## 4. Work Breakdown Structure (WBS) & Timeline

### Phase 1: Foundation (Weeks 1-16)
*   **Sprint 1-2:** Project setup, DB Schema design, Auth API.
*   **Sprint 3-4:** Study Timer (Frontend logic + Backend logging).
*   **Sprint 5-6:** Gamification logic (Points/Levels calculation) & Student Dashboard.
*   **Sprint 7-8:** Parent Dashboard & Child Linking logic. **(Milestone: Interim Report)**

### Phase 2: Expansion (Weeks 17-24)
*   **Sprint 9-10:** Social features (Friend requests, Leaderboards, Privacy logic).
*   **Sprint 11-12:** AI Integration (Groq/DeepSeek API connection & UI).
*   **Sprint 13:** Reward System (Parent creation/Student redemption flow).

### Phase 3: Refinement (Weeks 25-30)
*   **Sprint 14:** "Smart" Analytics (Insights generation, Streak risk logic).
*   **Sprint 15:** UI/UX Polish, Mobile Responsiveness check, PWA Offline testing.
*   **Sprint 16:** Final Testing, Bug Fixes, Documentation. **(Milestone: Final Report)**

---

## 5. Team Organization

| Member | Role | Primary Responsibilities |
| :--- | :--- | :--- |
| **Cheung King Wa** | **Frontend Lead** | React Architecture, UI/UX Design, PWA implementation, Mobile responsiveness. |
| **Wang Wai Shing** | **Backend Lead** | API development, Database Schema, Server management, Auth security. |
| **Liang Fai Hung** | **AI Specialist** | Integration of Groq/DeepSeek APIs, Parent Dashboard logic, Data visualization. |
| **Siu Tsz Kin** | **QA & Security** | Testing (Unit/E2E), Security audits (Privacy tiers), Social feature logic. |

---

## 6. Risk Management

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **AI Cost Overrun** | High | Use "Smart Analytics" (SQL) for 80% of insights. Cache AI responses. Use free tiers of Groq/DeepSeek. |
| **Offline Sync Issues** | Medium | Implement robust PWA Service Workers. Store sessions in `localStorage` and sync when online. |
| **Privacy Concerns** | High | Implement strict "Privacy Tiers" (Private/Friends/Public). Default to "Private" for minors. |
| **Scope Creep** | Medium | Strictly adhere to the Phase 1 vs. Phase 2 distinction. Move "Teacher" features to optional status. |

---

## 7. Evaluation Metrics

The project's success will be measured by:
1.  **System Uptime:** 99.9% availability during testing.
2.  **Engagement:** Average user maintains a streak > 3 days.
3.  **Performance:** Dashboard loads in < 2 seconds; Chatbot responds in < 3 seconds.
4.  **AI Accuracy:** Schedule optimizer generates logically valid time slots based on history.