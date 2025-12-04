this my project idea 

✅ FINAL PROJECT DEFINITION
🎯 PROBLEM STATEMENT (Combined - All Problems)

Frontend:

React.js 18+ (Component-based UI)

Tailwind CSS (Responsive Design)

PWA (Installable, Offline Support)

Backend:

Node.js + Express (REST API)

PostgreSQL (Relational Database)

JWT (Authentication)

AI Integration:

Groq API (Fast Chatbot Responses)

DeepSeek API (Learning Project Optimization)

Deployment:

Frontend: Vercel (PWA Support)

Backend: Railway/Render

Database: Railway/Supabase

"Students struggle with consistent study habits due to lack of motivation, immediate feedback, and effective learning strategies. Parents want to support their children's education but lack visibility into actual study behaviors and data-driven tools to provide meaningful guidance. Existing solutions either focus solely on basic time tracking (boring, no engagement) or shallow gamification (fun but no real insights), failing to combine behavioral analytics, family collaboration, and AI-powered personalization to create sustainable study habits and improved academic outcomes."
💡 SOLUTION

StudyQuest - An intelligent, gamified study companion that combines:

    Student engagement through gaming mechanics, social features, and rewards
    Parent empowerment with real-time visibility, engagement tools, and AI insights
    AI optimization for personalized study schedules and learning patterns
    Optional teacher integration for classroom-wide challenges and verification

👥 USER ROLES

    Students (Primary) - 13-18 years old
    Parents (Primary) - Active engagement, not just monitoring
    Teachers (Optional) - Students can add if they want teacher involvement

🚀 FEATURE SCOPE & PRIORITIZATION

After proposal:

    Actual development (you have weeks/months for FYP)

PHASE 1: PROPOSAL SCOPE (What to include in proposal - Day 3-8)

Include ALL features in proposal document - show comprehensive vision.

PHASE 2: DEVELOPMENT SCOPE (After proposal accepted)

Now let me organize what you actually BUILD:
📋 COMPLETE FEATURE LIST
A. STUDENT FEATURES

    Study Session Management
        Start/stop timer
        Select subject
        Add notes (optional)
        View session history

    Points & Leveling
        Earn points per minute studied
        Level up system
        Display current level/points

    Basic Achievements (5-10 badges)
        First session
        7-day streak
        Subject master
        Level milestones

    Personal Dashboard
        Total study time
        Current streak
        Points/level display
        Weekly progress chart

    Subject Tracking
        Select from predefined subjects
        Time per subject visualization

    Leaderboards
        Global leaderboard
        Friends leaderboard
        Weekly/monthly/all-time

    Challenges System
        Daily challenges
        Weekly challenges
        Custom challenges

    Social Features
        Add friends
        Study groups/teams
        Friend activity feed
        Private vs public profiles

    Advanced Achievements (20+ badges)
        Time-based badges
        Pattern badges (night owl, early bird)
        Social badges (team player)
        Comeback badges

    Study Together Mode
        Virtual co-studying sessions
        See friends studying live

    Competitive Features
        Challenge friends to duels
        Team competitions
        Seasonal tournaments

    Rewards Marketplace
        Spend points on virtual items
        Customize profile/avatar
        Unlock themes

B. PARENT FEATURES

    Child Progress Dashboard
        Total study time (daily/weekly/monthly)
        Subject breakdown
        Current streak
        Session history with timestamps

    Multi-Child Management
        Add multiple children
        Switch between children
        Individual dashboards

    Basic Notifications
        Email weekly summary
        Critical alerts (streak at risk)

    Study Time Analytics
        Line graph: study time over time
        Pie chart: subject distribution
        Consistency score

    Goal Setting
        Set study time goals for children
        Track goal progress
        Mark goals as achieved

    Custom Reward System
        Create rewards (e.g., "100 points = 1hr gaming")
        Children request redemption
        Parents approve/reject redemption
        Track redemption history


    Real-Time Notifications
        Push notifications (in-app)
        Session start/end alerts
        Achievement unlock alerts

    Session Verification
        Students upload photo proof
        Parents approve/reject
        Bonus points for verified sessions

    Encouragement Tools
        Send messages to child
        Award bonus points manually
        Comment on sessions

    Advanced Analytics
        Best study times heatmap
        Week-over-week comparison
        Subject progress trends
        Predictive insights

    Custom Challenges
        Parents create challenges for their kids
        Set point rewards
        Track completion

    Parental Controls
        Set max/min daily study time
        Approve friends
        Privacy settings

🔮 FUTURE WORK (Mention in proposal)

    Progress Reports
        Generate PDF reports
        Export to CSV
        Share with teachers

    Parent Community
        Forum/discussion board
        Tips and articles
        Success stories

    In-app Messaging
        Chat with child
        Conversation starters from AI

C. TEACHER FEATURES (Optional Role)
    Teacher Account Creation
        Teachers can register
        Create teacher profile

    Student Connection
        Students can add teacher (with teacher approval)
        Teacher sees list of connected students

    Class View
        See all connected students
        Basic class statistics (total study time)

    Class Challenges
        Create challenges for entire class
        Track participation
        Leaderboard for class

    Verification
        Verify student study sessions
        Verified sessions get bonus points

    Class Analytics
        Class average study time
        Subject distribution for class
        Student comparison

    Assignment Integration
        Link study sessions to assignments
        Track assignment completion
        Grade integration

D. AI FEATURES 🤖

Based on your input:

    ✅ Study Schedule Optimization - Use AI
    ✅ Chatbot Assistant - Use AI
    ⚡ Other features - Data analysis (no AI needed)

    AI Study Schedule Optimizer
        Input: Student's study history, subject list, goals
        AI analyzes best times for each subject
        Generates weekly schedule suggestion
        API: DeepSeek (complex reasoning, cheap)
        Frequency: Once per week or on-demand

    AI Chatbot Assistant
        Students ask study-related questions
        "When should I study Math?"
        "Why am I losing motivation?"
        "How can I improve my streak?"
        AI responds with personalized advice
        API: Groq (fast, free tier)
        Frequency: Real-time

    Study Pattern Analysis (Pure data analysis)
        Calculate best study times from historical data
        Identify peak productivity hours
        No AI needed - just SQL queries and statistics
        Display as insights: "You study best 7-9 PM"

    Subject Recommendations (Pure data analysis)
        Compare time spent per subject
        Flag subjects with low study time
        Simple ranking algorithm
        Display: "Math needs more attention this week"

    Streak Predictions (Simple logic)
        If no session today after 8 PM → "Streak at risk!"
        Based on user's typical study times
        Simple conditional logic

    Progress Insights (Data visualization)
        Week-over-week change percentages
        Subject time trends
        Consistency calculations
        All done with database queries

    AI Parent Insights
        Generate nuanced parenting suggestions
        "Sarah studies better in mornings - encourage morning sessions"
        API: GPT-4o-mini or DeepSeek

    Motivational Messages (AI-enhanced)
        Personalized encouragement
        Context-aware messaging
        Can start with templates, enhance with AI later

    Learning Style Detection
        AI analyzes session patterns
        Identifies: visual learner, long sessions vs short bursts
        Recommends study techniques

    Predictive Analytics
        Predict exam performance based on study patterns
        Risk detection (burnout, dropping off)
        Intervention suggestions

🎯 SMART APPROACH - AI STRATEGY

What NEEDS AI:

    ✅ Study Schedule Optimization - Too complex for simple algorithms
    ✅ Chatbot - Conversational, needs natural language

What DOESN'T need AI:

    ✅ Pattern Analysis - SQL queries + basic statistics
    ✅ Recommendations - Ranking algorithms
    ✅ Insights - Data aggregation + templates
    ✅ Streaks - Simple conditional logic

Why this is smart:

    ✅ Saves AI API costs
    ✅ Faster performance (no API calls)
    ✅ More reliable (no API downtime)
    ✅ Still impressive for FYP
    ✅ Use AI where it adds REAL value


SOCIAL FEATURES APPROACH:

Perfect solution:
Privacy Tiers:

    Private Profile (default)
        Only visible to friends
        Not on global leaderboard
        Can still join teams

    Friends Only
        Visible to friends
        Only friends leaderboard
        Can join friend teams

    Public Profile
        Global leaderboard
        Can join public teams
        Full social features

Students choose their comfort level!
Team Types:

    Private Teams (friends only)
        Invite-only
        Study together
        Internal leaderboard

    Public Teams (optional)
        Anyone can join
        Compete with other teams
        Global team rankings

this is my folder

C:\Users\eeapp\OneDrive\Desktop\FYP_GP20>dir /s /b | findstr /v /i "studyquest-app" | findstr /v /i ".git" | findstr /v /i "Diagram" | findstr /v /i "node_modules"
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\Doc
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\login.md
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\text.txt
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\Timetable.md
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\.env
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\db
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\middleware
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\migrations
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\package-lock.json
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\package.json
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\routes
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\server.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\utils
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\db\connection.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\middleware\auth.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\migrations\001_initial_schema.sql
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\routes\auth.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\routes\sessions.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\routes\student.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\utils\gamification.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\Doc\FYP(GP20)_Initial Report_FIN.docx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\Doc\idea.md
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\Doc\Initial Report Guidelines_PBL_c0f2e215d375da042ddc8b675b8d5d56.docx

C:\Users\eeapp\OneDrive\Desktop\FYP_GP20>

This is my database on supabase

-- ============================================
-- StudyQuest Database Schema
-- FYP GP20 - Complete Migration
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STUDENTS TABLE
-- Stores user profiles and gamification data
-- ============================================
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Profile Information
    full_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    
    -- Gamification Stats
    total_points INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    experience_points INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    
    -- Study Stats
    total_study_minutes INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_study_time INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT username_length CHECK (char_length(username) >= 3),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for faster lookups
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_username ON students(username);

-- ============================================
-- STUDY_SESSIONS TABLE
-- Tracks individual study sessions
-- ============================================
CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Session Details
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255),
    duration_minutes INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Points & Rewards
    points_earned INTEGER DEFAULT 0,
    experience_gained INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    
    -- Session Status
    status VARCHAR(20) DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Notes
    notes TEXT,
    
    -- Constraints
    CONSTRAINT duration_positive CHECK (duration_minutes >= 0),
    CONSTRAINT duration_non_negative CHECK (duration >= 0),
    CONSTRAINT xp_non_negative CHECK (xp_earned >= 0),
    CONSTRAINT valid_status CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'abandoned')),
    CONSTRAINT ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Indexes for faster queries
CREATE INDEX idx_sessions_student ON study_sessions(student_id);
CREATE INDEX idx_sessions_date ON study_sessions(started_at);
CREATE INDEX idx_sessions_started_at ON study_sessions(started_at);
CREATE INDEX idx_sessions_status ON study_sessions(status);
CREATE INDEX idx_sessions_is_active ON study_sessions(is_active);

-- ============================================
-- ACHIEVEMENTS TABLE
-- Defines available achievements
-- ============================================
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Achievement Details
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50),
    category VARCHAR(50),
    
    -- Requirements
    requirement_type VARCHAR(50) NOT NULL,
    requirement_value INTEGER NOT NULL,
    
    -- Rewards
    points_reward INTEGER DEFAULT 0,
    badge_tier VARCHAR(20) DEFAULT 'bronze',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    -- Constraints
    CONSTRAINT valid_tier CHECK (badge_tier IN ('bronze', 'silver', 'gold', 'platinum'))
);

-- ============================================
-- STUDENT_ACHIEVEMENTS TABLE
-- Junction table for student achievements
-- ============================================
CREATE TABLE student_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    
    -- Unlock Details
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    progress INTEGER DEFAULT 0,
    
    -- Constraints
    UNIQUE(student_id, achievement_id)
);

-- Indexes
CREATE INDEX idx_student_achievements ON student_achievements(student_id);

-- ============================================
-- DAILY_GOALS TABLE
-- Tracks daily study goals
-- ============================================
CREATE TABLE daily_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Goal Details
    goal_date DATE NOT NULL,
    target_minutes INTEGER NOT NULL DEFAULT 60,
    completed_minutes INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    UNIQUE(student_id, goal_date),
    CONSTRAINT target_positive CHECK (target_minutes > 0)
);

-- Index
CREATE INDEX idx_daily_goals_student_date ON daily_goals(student_id, goal_date);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for students table
CREATE TRIGGER update_students_updated_at 
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for study_sessions table
CREATE TRIGGER update_study_sessions_updated_at 
    BEFORE UPDATE ON study_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate points from study duration
CREATE OR REPLACE FUNCTION calculate_session_points(duration INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Base: 1 point per minute
    -- Bonus: +10 points for sessions >= 25 minutes (Pomodoro)
    -- Bonus: +20 points for sessions >= 60 minutes
    IF duration >= 60 THEN
        RETURN duration + 20;
    ELSIF duration >= 25 THEN
        RETURN duration + 10;
    ELSE
        RETURN duration;
    END IF;
END;
$$ language 'plpgsql';

-- Function to update student stats after session
CREATE OR REPLACE FUNCTION update_student_stats_after_session()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        UPDATE students
        SET 
            total_study_minutes = total_study_minutes + COALESCE(NEW.duration_minutes, NEW.duration, 0),
            total_study_time = total_study_time + COALESCE(NEW.duration_minutes, NEW.duration, 0),
            total_sessions = total_sessions + 1,
            total_points = total_points + COALESCE(NEW.points_earned, 0),
            experience_points = experience_points + COALESCE(NEW.experience_gained, NEW.xp_earned, 0),
            xp = xp + COALESCE(NEW.experience_gained, NEW.xp_earned, 0)
        WHERE id = NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update stats when session is completed
CREATE TRIGGER update_stats_after_session
    AFTER INSERT OR UPDATE OF status ON study_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_student_stats_after_session();

-- ============================================
-- SEED DATA - Initial Achievements
-- ============================================
INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value, points_reward, badge_tier) VALUES
-- First Steps
('First Session', 'Complete your first study session', '🎯', 'milestone', 'sessions_count', 1, 50, 'bronze'),
('Early Bird', 'Complete 5 study sessions', '🌅', 'milestone', 'sessions_count', 5, 100, 'bronze'),
('Dedicated Learner', 'Complete 25 study sessions', '📚', 'milestone', 'sessions_count', 25, 250, 'silver'),
('Study Master', 'Complete 100 study sessions', '👑', 'milestone', 'sessions_count', 100, 1000, 'gold'),

-- Time-based
('Hour of Power', 'Study for 60 minutes in total', '⏰', 'time', 'total_minutes', 60, 75, 'bronze'),
('Marathon Runner', 'Study for 10 hours in total', '🏃', 'time', 'total_minutes', 600, 500, 'silver'),
('Time Warrior', 'Study for 50 hours in total', '⚔️', 'time', 'total_minutes', 3000, 2500, 'gold'),

-- Streaks
('On Fire', 'Study 3 days in a row', '🔥', 'streak', 'streak_days', 3, 150, 'bronze'),
('Unstoppable', 'Study 7 days in a row', '💪', 'streak', 'streak_days', 7, 350, 'silver'),
('Legend', 'Study 30 days in a row', '🌟', 'streak', 'streak_days', 30, 1500, 'platinum'),

-- Focus Sessions
('Pomodoro Pro', 'Complete a 25-minute focused session', '🍅', 'focus', 'single_session_minutes', 25, 100, 'bronze'),
('Deep Work', 'Complete a 60-minute focused session', '🧠', 'focus', 'single_session_minutes', 60, 200, 'silver'),
('Flow State', 'Complete a 120-minute focused session', '🌊', 'focus', 'single_session_minutes', 120, 500, 'gold');

-- ============================================
-- VIEWS FOR ANALYTICS
-- ============================================

-- Student leaderboard view
CREATE VIEW student_leaderboard AS
SELECT 
    id,
    username,
    full_name,
    avatar_url,
    total_points,
    current_level,
    total_study_minutes,
    total_sessions,
    streak_days,
    ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
FROM students
ORDER BY total_points DESC;

-- Recent sessions view
CREATE VIEW recent_sessions AS
SELECT 
    ss.id,
    ss.student_id,
    s.username,
    ss.subject,
    ss.topic,
    COALESCE(ss.duration_minutes, ss.duration, 0) as duration_minutes,
    COALESCE(ss.points_earned, 0) as points_earned,
    ss.started_at,
    ss.ended_at,
    ss.status
FROM study_sessions ss
JOIN students s ON ss.student_id = s.id
ORDER BY ss.started_at DESC;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE students IS 'Core user profiles with gamification stats';
COMMENT ON TABLE study_sessions IS 'Individual study session records';
COMMENT ON TABLE achievements IS 'Available achievements and badges';
COMMENT ON TABLE student_achievements IS 'Unlocked achievements per student';
COMMENT ON TABLE daily_goals IS 'Daily study targets and progress';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Database schema created successfully! 🎉' as message;

I have complete backend,db setting,github sitting , Study Session API , can register user with hashed password, Authentication System, backend connect to supabase 

dir /s /b

C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src>dir /s /b
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\App.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\App.test.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\index.css
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\index.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\logo.svg
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\reportWebVitals.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\setupTests.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\utils
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\auth
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\dashboard
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\shared
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\StudyTimer
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\auth\Login.jsx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\auth\Register.jsx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\dashboard\CourseCard.jsx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\dashboard\Dashboard.jsx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\shared\Navbar.jsx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\shared\PixelButton.jsx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\shared\PixelCard.jsx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\shared\ProgressBar.jsx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\shared\StatCard.jsx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\components\StudyTimer\StudyTimer.jsx
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\utils\api.js
C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src\utils\auth.js

C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\frontend\src>