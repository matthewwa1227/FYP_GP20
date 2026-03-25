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
('First Session', 'Complete your first study session', '?Ž¯', 'milestone', 'sessions_count', 1, 50, 'bronze'),
('Early Bird', 'Complete 5 study sessions', '??', 'milestone', 'sessions_count', 5, 100, 'bronze'),
('Dedicated Learner', 'Complete 25 study sessions', '??', 'milestone', 'sessions_count', 25, 250, 'silver'),
('Study Master', 'Complete 100 study sessions', '??', 'milestone', 'sessions_count', 100, 1000, 'gold'),

-- Time-based
('Hour of Power', 'Study for 60 minutes in total', '??, 'time', 'total_minutes', 60, 75, 'bronze'),
('Marathon Runner', 'Study for 10 hours in total', '??', 'time', 'total_minutes', 600, 500, 'silver'),
('Time Warrior', 'Study for 50 hours in total', '?”ï?', 'time', 'total_minutes', 3000, 2500, 'gold'),

-- Streaks
('On Fire', 'Study 3 days in a row', '?”¥', 'streak', 'streak_days', 3, 150, 'bronze'),
('Unstoppable', 'Study 7 days in a row', '?’ª', 'streak', 'streak_days', 7, 350, 'silver'),
('Legend', 'Study 30 days in a row', '??', 'streak', 'streak_days', 30, 1500, 'platinum'),

-- Focus Sessions
('Pomodoro Pro', 'Complete a 25-minute focused session', '??', 'focus', 'single_session_minutes', 25, 100, 'bronze'),
('Deep Work', 'Complete a 60-minute focused session', '??', 'focus', 'single_session_minutes', 60, 200, 'silver'),
('Flow State', 'Complete a 120-minute focused session', '??', 'focus', 'single_session_minutes', 120, 500, 'gold');

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
SELECT 'Database schema created successfully! ??' as message;
-- 1. Create Parents Table
CREATE TABLE parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create the Relationship Table (Many-to-Many allows 2 parents for 1 child)
CREATE TABLE parent_student_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_id, student_id) -- Prevent duplicate links
);

-- 3. Create Connection Codes (Temporary codes for linking)
CREATE TABLE connection_codes (
    code VARCHAR(6) PRIMARY KEY, -- e.g., "A7X92B"
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast code lookup
CREATE INDEX idx_connection_codes_student ON connection_codes(student_id);
-- AI Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  conversation_type VARCHAR(20) DEFAULT 'chat' CHECK (conversation_type IN ('chat', 'schedule', 'tips')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_conversations ON ai_conversations(user_id, created_at);

-- Scheduled Sessions table
CREATE TABLE IF NOT EXISTS scheduled_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id INT,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'skipped', 'rescheduled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_schedule ON scheduled_sessions(user_id, start_time);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(100),
  priority INT DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  estimated_duration INT DEFAULT 30,
  due_date TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_tasks ON tasks(user_id, status);

-- Add foreign key to scheduled_sessions for tasks
ALTER TABLE scheduled_sessions 
ADD CONSTRAINT fk_scheduled_task 
FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  subject VARCHAR(100) DEFAULT 'General',
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
  due_date TIMESTAMP,
  estimated_minutes INTEGER DEFAULT 30,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks';

ALTER TABLE tasks ADD COLUMN priority_temp varchar(20);

ALTER TABLE tasks DROP CONSTRAINT tasks_priority_check;

ALTER TABLE tasks 
ALTER COLUMN priority TYPE varchar(20) 
USING CASE 
  WHEN priority = 1 THEN 'high'
  WHEN priority = 2 THEN 'medium'
  WHEN priority = 3 THEN 'low'
  ELSE 'medium'
END;

-- ============================================
-- TUTOR SESSIONS TABLE (with UUID foreign key)
-- ============================================
CREATE TABLE IF NOT EXISTS tutor_sessions (
    id SERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('learn', 'quiz', 'hint', 'explain')),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    hints_given INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TUTOR MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tutor_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ADD TUTOR STATS TO STUDENTS (if not exists)
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'tutor_sessions_count') THEN
        ALTER TABLE students ADD COLUMN tutor_sessions_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'total_tutor_time') THEN
        ALTER TABLE students ADD COLUMN total_tutor_time INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_student ON tutor_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_time ON tutor_sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_messages_session ON tutor_messages(session_id);
-- =============================================
-- MIGRATION: HK Learning Schedule System
-- Phase 1: Student tier + schedule foundations
-- =============================================

-- 1. Add tier columns to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS form_level VARCHAR(5);
ALTER TABLE students ADD COLUMN IF NOT EXISTS age_tier VARCHAR(10);
ALTER TABLE students ADD COLUMN IF NOT EXISTS daily_time_limit_minutes INTEGER;
ALTER TABLE students ADD COLUMN IF NOT EXISTS weekly_schedule_days INTEGER;
ALTER TABLE students ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en';
ALTER TABLE students ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- 2. Function: compute age_tier + defaults from form_level
CREATE OR REPLACE FUNCTION set_tier_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute age_tier
  IF NEW.form_level IN ('P1','P2','P3') THEN
    NEW.age_tier := 'P1-P3';
  ELSIF NEW.form_level IN ('P4','P5','P6') THEN
    NEW.age_tier := 'P4-P6';
  ELSIF NEW.form_level IN ('S1','S2','S3') THEN
    NEW.age_tier := 'S1-S3';
  ELSIF NEW.form_level IN ('S4','S5','S6') THEN
    NEW.age_tier := 'S4-S6';
  ELSE
    NEW.age_tier := NULL;
  END IF;

  -- Set default daily time limit if not manually set
  IF NEW.daily_time_limit_minutes IS NULL AND NEW.age_tier IS NOT NULL THEN
    CASE NEW.age_tier
      WHEN 'P1-P3' THEN NEW.daily_time_limit_minutes := 15;
      WHEN 'P4-P6' THEN NEW.daily_time_limit_minutes := 25;
      WHEN 'S1-S3' THEN NEW.daily_time_limit_minutes := 40;
      WHEN 'S4-S6' THEN NEW.daily_time_limit_minutes := 60;
    END CASE;
  END IF;

  -- Set default weekly schedule days
  IF NEW.weekly_schedule_days IS NULL AND NEW.age_tier IS NOT NULL THEN
    CASE NEW.age_tier
      WHEN 'P1-P3' THEN NEW.weekly_schedule_days := 4;
      WHEN 'P4-P6' THEN NEW.weekly_schedule_days := 5;
      WHEN 'S1-S3' THEN NEW.weekly_schedule_days := 6;
      WHEN 'S4-S6' THEN NEW.weekly_schedule_days := 6;
    END CASE;
  END IF;

  NEW.onboarding_completed := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger: auto-fill tier data on INSERT or UPDATE of form_level
DROP TRIGGER IF EXISTS trigger_set_tier_defaults ON students;
CREATE TRIGGER trigger_set_tier_defaults
  BEFORE INSERT OR UPDATE OF form_level ON students
  FOR EACH ROW
  WHEN (NEW.form_level IS NOT NULL)
  EXECUTE FUNCTION set_tier_defaults();

-- 4. Learning schedules (the core schedule table)
-- FIX: student_id is UUID, not INTEGER
CREATE TABLE IF NOT EXISTS learning_schedules (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  topic VARCHAR(150) NOT NULL,
  form_level VARCHAR(5) NOT NULL,
  age_tier VARCHAR(10) NOT NULL,

  total_chapters INTEGER DEFAULT 4,
  current_chapter INTEGER DEFAULT 1,
  current_day_in_chapter INTEGER DEFAULT 1,
  chapters JSONB DEFAULT '[]'::jsonb,

  hk_codes TEXT[] DEFAULT '{}',

  mastery_scores JSONB DEFAULT '{}'::jsonb,
  overall_mastery DECIMAL(5,2) DEFAULT 0,
  mastery_gate INTEGER DEFAULT 70,

  total_time_spent_minutes INTEGER DEFAULT 0,

  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','paused','completed','abandoned')),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Daily session log (per-day tracking for safety + analytics)
-- FIX: student_id and schedule_id use correct types
CREATE TABLE IF NOT EXISTS daily_session_log (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  schedule_id INTEGER REFERENCES learning_schedules(id) ON DELETE SET NULL,

  session_date DATE DEFAULT CURRENT_DATE,
  planned_minutes INTEGER,
  actual_minutes INTEGER DEFAULT 0,

  chapter INTEGER,
  scenes_completed TEXT[] DEFAULT '{}',
  questions_answered INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  mastery_at_end DECIMAL(5,2),

  xp_earned INTEGER DEFAULT 0,
  exceeded_time_limit BOOLEAN DEFAULT FALSE,
  is_rest_day BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Burnout checks (every 7 days for S4-S6, on-demand for others)
-- FIX: student_id is UUID
CREATE TABLE IF NOT EXISTS burnout_checks (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  check_date DATE DEFAULT CURRENT_DATE,
  consecutive_active_days INTEGER,
  avg_daily_minutes DECIMAL(5,2),
  flag_level VARCHAR(10) DEFAULT 'none'
    CHECK (flag_level IN ('none','warning','critical')),
  recommendation TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Index for performance
CREATE INDEX IF NOT EXISTS idx_learning_schedules_student
  ON learning_schedules(student_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_session_log_student_date
  ON daily_session_log(student_id, session_date);
CREATE INDEX IF NOT EXISTS idx_students_form_level
  ON students(form_level);

  -- =============================================
-- MIGRATION: HK Learning Schedule System
-- Phase 1 (UUID-corrected) + Phase 2
-- =============================================

-- =============================================
-- PART A: Student tier columns
-- =============================================
ALTER TABLE students ADD COLUMN IF NOT EXISTS form_level VARCHAR(5);
ALTER TABLE students ADD COLUMN IF NOT EXISTS age_tier VARCHAR(10);
ALTER TABLE students ADD COLUMN IF NOT EXISTS daily_time_limit_minutes INTEGER;
ALTER TABLE students ADD COLUMN IF NOT EXISTS weekly_schedule_days INTEGER;
ALTER TABLE students ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en';
ALTER TABLE students ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Trigger function: auto-compute tier defaults from form_level
CREATE OR REPLACE FUNCTION set_tier_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.form_level IN ('P1','P2','P3') THEN
    NEW.age_tier := 'P1-P3';
  ELSIF NEW.form_level IN ('P4','P5','P6') THEN
    NEW.age_tier := 'P4-P6';
  ELSIF NEW.form_level IN ('S1','S2','S3') THEN
    NEW.age_tier := 'S1-S3';
  ELSIF NEW.form_level IN ('S4','S5','S6') THEN
    NEW.age_tier := 'S4-S6';
  ELSE
    NEW.age_tier := NULL;
  END IF;

  IF NEW.daily_time_limit_minutes IS NULL AND NEW.age_tier IS NOT NULL THEN
    CASE NEW.age_tier
      WHEN 'P1-P3' THEN NEW.daily_time_limit_minutes := 15;
      WHEN 'P4-P6' THEN NEW.daily_time_limit_minutes := 25;
      WHEN 'S1-S3' THEN NEW.daily_time_limit_minutes := 40;
      WHEN 'S4-S6' THEN NEW.daily_time_limit_minutes := 60;
    END CASE;
  END IF;

  IF NEW.weekly_schedule_days IS NULL AND NEW.age_tier IS NOT NULL THEN
    CASE NEW.age_tier
      WHEN 'P1-P3' THEN NEW.weekly_schedule_days := 4;
      WHEN 'P4-P6' THEN NEW.weekly_schedule_days := 5;
      WHEN 'S1-S3' THEN NEW.weekly_schedule_days := 6;
      WHEN 'S4-S6' THEN NEW.weekly_schedule_days := 6;
    END CASE;
  END IF;

  NEW.onboarding_completed := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_tier_defaults ON students;
CREATE TRIGGER trigger_set_tier_defaults
  BEFORE INSERT OR UPDATE OF form_level ON students
  FOR EACH ROW
  WHEN (NEW.form_level IS NOT NULL)
  EXECUTE FUNCTION set_tier_defaults();

-- =============================================
-- PART B: Learning schedules (UUID foreign keys)
-- =============================================
CREATE TABLE IF NOT EXISTS learning_schedules (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic VARCHAR(150) NOT NULL,
  subject VARCHAR(100),
  form_level VARCHAR(5) NOT NULL,
  age_tier VARCHAR(10) NOT NULL,

  -- Chapter structure
  total_chapters INTEGER DEFAULT 4,
  current_chapter INTEGER DEFAULT 1,
  current_day_in_chapter INTEGER DEFAULT 1,
  chapters JSONB DEFAULT '[]'::jsonb,

  -- HK curriculum codes (e.g., '{"M3.1","M3.2"}')
  hk_codes TEXT[] DEFAULT '{}',

  -- Mastery tracking
  overall_mastery DECIMAL(5,2) DEFAULT 0,
  mastery_gate INTEGER DEFAULT 70,
  total_questions_answered INTEGER DEFAULT 0,
  total_questions_correct INTEGER DEFAULT 0,

  -- Time tracking
  total_time_spent_minutes INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','paused','completed','abandoned')),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Prevent duplicate active schedules for same topic
  CONSTRAINT unique_active_schedule 
    UNIQUE (student_id, topic, status)
);

-- =============================================
-- PART C: Daily session log (per-day tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS daily_session_log (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  schedule_id INTEGER REFERENCES learning_schedules(id) ON DELETE SET NULL,

  session_date DATE DEFAULT CURRENT_DATE,
  session_started_at TIMESTAMP DEFAULT NOW(),
  session_ended_at TIMESTAMP,

  planned_minutes INTEGER,
  actual_minutes INTEGER DEFAULT 0,

  chapter INTEGER,
  scenes_completed TEXT[] DEFAULT '{}',
  questions_answered INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  mastery_at_end DECIMAL(5,2),

  xp_earned INTEGER DEFAULT 0,
  exceeded_time_limit BOOLEAN DEFAULT FALSE,
  is_rest_day BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PART D: Burnout checks
-- =============================================
CREATE TABLE IF NOT EXISTS burnout_checks (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  check_date DATE DEFAULT CURRENT_DATE,
  consecutive_active_days INTEGER,
  avg_daily_minutes DECIMAL(5,2),
  flag_level VARCHAR(10) DEFAULT 'none'
    CHECK (flag_level IN ('none','warning','critical')),
  recommendation TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PART E: Add mastery columns to story_quest_progress
-- =============================================
ALTER TABLE story_quest_progress 
  ADD COLUMN IF NOT EXISTS mastery_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE story_quest_progress 
  ADD COLUMN IF NOT EXISTS questions_answered INTEGER DEFAULT 0;
ALTER TABLE story_quest_progress 
  ADD COLUMN IF NOT EXISTS questions_correct INTEGER DEFAULT 0;
ALTER TABLE story_quest_progress 
  ADD COLUMN IF NOT EXISTS schedule_id INTEGER REFERENCES learning_schedules(id) ON DELETE SET NULL;
ALTER TABLE story_quest_progress 
  ADD COLUMN IF NOT EXISTS total_time_minutes INTEGER DEFAULT 0;

-- =============================================
-- PART F: Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_learning_schedules_student
  ON learning_schedules(student_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_session_log_student_date
  ON daily_session_log(student_id, session_date);
CREATE INDEX IF NOT EXISTS idx_daily_session_log_schedule
  ON daily_session_log(schedule_id);
CREATE INDEX IF NOT EXISTS idx_students_form_level
  ON students(form_level);
CREATE INDEX IF NOT EXISTS idx_burnout_checks_student
  ON burnout_checks(student_id, check_date);
CREATE INDEX IF NOT EXISTS idx_story_progress_schedule
  ON story_quest_progress(schedule_id);
-- 1. Add is_rest_day column to daily_session_log (needed by rest-day route)
ALTER TABLE daily_session_log 
ADD COLUMN IF NOT EXISTS is_rest_day BOOLEAN DEFAULT FALSE;

-- 2. Add xp_earned column to daily_session_log (needed by mastery route)
ALTER TABLE daily_session_log 
ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0;

-- 3. Add questions_answered and questions_correct to daily_session_log
ALTER TABLE daily_session_log 
ADD COLUMN IF NOT EXISTS questions_answered INTEGER DEFAULT 0;

ALTER TABLE daily_session_log 
ADD COLUMN IF NOT EXISTS questions_correct INTEGER DEFAULT 0;

-- 4. Add total_time_spent_minutes to learning_schedules
ALTER TABLE learning_schedules 
ADD COLUMN IF NOT EXISTS total_time_spent_minutes INTEGER DEFAULT 0;

-- 5. Create burnout_checks table if it doesn't exist
CREATE TABLE IF NOT EXISTS burnout_checks (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  flag_level INTEGER DEFAULT 1,
  recommendation TEXT,
  check_date DATE DEFAULT CURRENT_DATE,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- FAMILY DASHBOARD: Missing columns migration
-- =============================================

-- 1. learning_schedules: add missing columns
ALTER TABLE learning_schedules 
ADD COLUMN IF NOT EXISTS subject VARCHAR(100) DEFAULT 'General';

ALTER TABLE learning_schedules 
ADD COLUMN IF NOT EXISTS total_time_spent_minutes INTEGER DEFAULT 0;

-- 2. daily_session_log: add missing columns
ALTER TABLE daily_session_log 
ADD COLUMN IF NOT EXISTS session_ended_at TIMESTAMP;

ALTER TABLE daily_session_log 
ADD COLUMN IF NOT EXISTS is_rest_day BOOLEAN DEFAULT FALSE;

ALTER TABLE daily_session_log 
ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0;

ALTER TABLE daily_session_log 
ADD COLUMN IF NOT EXISTS questions_answered INTEGER DEFAULT 0;

ALTER TABLE daily_session_log 
ADD COLUMN IF NOT EXISTS questions_correct INTEGER DEFAULT 0;

-- 3. burnout_checks table (whole table may be missing)
CREATE TABLE IF NOT EXISTS burnout_checks (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  flag_level INTEGER DEFAULT 1,
  recommendation TEXT,
  check_date DATE DEFAULT CURRENT_DATE,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Verify everything worked
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'learning_schedules' ORDER BY ordinal_position;

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'daily_session_log' ORDER BY ordinal_position;
-- ============================================
-- Migration: The Procrastination Prophecy
-- Adds meta-narrative tracking for shadow of doom and hero power
-- ============================================

-- ============================================
-- HERO JOURNEY TABLE - Tracks user's study journey/progress
-- ============================================
CREATE TABLE hero_journeys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Journey Progress
    current_stage INTEGER DEFAULT 1, -- 1-10 stages of the journey
    total_stages INTEGER DEFAULT 10,
    journey_title VARCHAR(100) DEFAULT 'The Path of the Scholar',
    
    -- Hero Stats
    hero_power INTEGER DEFAULT 10, -- Increases with streaks
    hero_power_max INTEGER DEFAULT 100,
    
    -- Shadow of Doom (the villain)
    shadow_doom_level INTEGER DEFAULT 0, -- 0-100, grows when missing days
    shadow_doom_active BOOLEAN DEFAULT false,
    
    -- Streak Tracking for Narrative
    streak_days_at_start INTEGER DEFAULT 0,
    longest_streak_achieved INTEGER DEFAULT 0,
    
    -- Journey Milestones
    milestones_completed TEXT[] DEFAULT '{}',
    current_milestone VARCHAR(100),
    
    -- Story Context
    hero_name VARCHAR(50),
    chosen_path VARCHAR(50), -- 'wisdom', 'courage', 'creativity'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(student_id)
);

CREATE INDEX idx_hero_journeys_student ON hero_journeys(student_id);

-- ============================================
-- JOURNEY STAGES TABLE - Defines each stage of the study journey
-- ============================================
CREATE TABLE journey_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_number INTEGER NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    required_streak_days INTEGER DEFAULT 0,
    required_total_minutes INTEGER DEFAULT 0,
    hero_power_bonus INTEGER DEFAULT 5,
    
    -- Stage Content
    lesson_topic VARCHAR(100),
    challenge_type VARCHAR(50), -- 'quiz', 'battle', 'choice'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default journey stages
INSERT INTO journey_stages (stage_number, title, description, required_streak_days, required_total_minutes, hero_power_bonus, lesson_topic, challenge_type) VALUES
(1, 'The Awakening', 'You discover the power of learning. The Shadow is weak.', 0, 0, 10, 'Introduction', 'choice'),
(2, 'First Steps', 'Your first study session strengthens your inner light.', 1, 15, 5, 'Study Basics', 'quiz'),
(3, 'The Spark', 'A small flame grows. The Shadow retreats slightly.', 2, 45, 5, 'Focus Techniques', 'quiz'),
(4, 'Rising Dawn', 'You feel your power growing with each day.', 3, 90, 10, 'Time Management', 'battle'),
(5, 'The Guardian', 'You can now protect your time from distractions.', 5, 180, 10, 'Defense Against Procrastination', 'battle'),
(6, 'Steady Flame', 'Your consistency makes you stronger.', 7, 300, 15, 'Deep Learning', 'quiz'),
(7, 'The Scholar', 'Knowledge flows through you. The Shadow fears you.', 10, 480, 15, 'Advanced Concepts', 'battle'),
(8, 'Beacon of Light', 'Others can see your dedication shining.', 14, 720, 20, 'Teaching Others', 'choice'),
(9, 'Master of Self', 'You control your time. The Shadow is almost gone.', 21, 1000, 20, 'Mastery', 'battle'),
(10, 'The Legend', 'You have conquered the Procrastination Prophecy!', 30, 1500, 25, 'Victory', 'finale');

-- ============================================
-- JOURNEY LOGS TABLE - Daily tracking for narrative
-- ============================================
CREATE TABLE journey_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Daily Stats
    studied_today BOOLEAN DEFAULT false,
    minutes_studied INTEGER DEFAULT 0,
    
    -- Narrative Events
    shadow_grew BOOLEAN DEFAULT false,
    hero_power_gained INTEGER DEFAULT 0,
    milestone_reached VARCHAR(100),
    
    -- Story Context
    daily_message TEXT,
    shadow_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(student_id, log_date)
);

CREATE INDEX idx_journey_logs_student_date ON journey_logs(student_id, log_date);

-- ============================================
-- NARRATIVE EVENTS TABLE - Tracks story events
-- ============================================
CREATE TABLE narrative_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL, -- 'streak_milestone', 'shadow_attack', 'power_up', 'stage_complete'
    event_title VARCHAR(100),
    event_description TEXT,
    
    -- Effects
    hero_power_change INTEGER DEFAULT 0,
    shadow_doom_change INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_narrative_events_student ON narrative_events(student_id);

-- ============================================
-- FUNCTIONS FOR HERO JOURNEY
-- ============================================

-- Function to update hero power based on streak
CREATE OR REPLACE FUNCTION calculate_hero_power(p_streak_days INTEGER)
RETURNS INTEGER AS $$
DECLARE
    base_power INTEGER := 10;
    streak_bonus INTEGER;
BEGIN
    -- Base power + streak bonus
    streak_bonus := LEAST(p_streak_days * 2, 50); -- Cap at 50 bonus
    RETURN base_power + streak_bonus;
END;
$$ language 'plpgsql';

-- Function to calculate shadow doom level
CREATE OR REPLACE FUNCTION calculate_shadow_doom(
    p_last_study_date DATE,
    p_current_streak INTEGER,
    p_streak_broken BOOLEAN
)
RETURNS INTEGER AS $$
DECLARE
    days_since_study INTEGER;
    shadow_level INTEGER := 0;
BEGIN
    IF p_streak_broken THEN
        days_since_study := CURRENT_DATE - p_last_study_date;
        -- Shadow grows by 10 for each missed day, capped at 100
        shadow_level := LEAST(days_since_study * 10, 100);
    ELSE
        -- Shadow retreats as streak grows
        shadow_level := GREATEST(0, 50 - (p_current_streak * 5));
    END IF;
    
    RETURN shadow_level;
END;
$$ language 'plpgsql';

-- Function to update hero journey on study session
CREATE OR REPLACE FUNCTION update_hero_journey_on_study()
RETURNS TRIGGER AS $$
DECLARE
    v_student_id UUID;
    v_current_streak INTEGER;
    v_hero_power INTEGER;
    v_shadow_level INTEGER;
    v_journey RECORD;
BEGIN
    -- Only process completed sessions
    IF NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;
    
    v_student_id := NEW.student_id;
    
    -- Get current streak
    SELECT current_streak INTO v_current_streak
    FROM students WHERE id = v_student_id;
    
    -- Calculate new hero power
    v_hero_power := calculate_hero_power(v_current_streak);
    
    -- Calculate shadow level (shadow retreats when studying)
    v_shadow_level := calculate_shadow_doom(CURRENT_DATE, v_current_streak, false);
    
    -- Update or create hero journey
    INSERT INTO hero_journeys (
        student_id, 
        hero_power, 
        shadow_doom_level,
        shadow_doom_active,
        longest_streak_achieved
    )
    VALUES (
        v_student_id, 
        v_hero_power, 
        v_shadow_level,
        v_shadow_level > 30,
        v_current_streak
    )
    ON CONFLICT (student_id) 
    DO UPDATE SET
        hero_power = v_hero_power,
        shadow_doom_level = v_shadow_level,
        shadow_doom_active = v_shadow_level > 30,
        longest_streak_achieved = GREATEST(hero_journeys.longest_streak_achieved, v_current_streak),
        updated_at = CURRENT_TIMESTAMP;
    
    -- Log today's journey
    INSERT INTO journey_logs (
        student_id,
        log_date,
        studied_today,
        minutes_studied,
        hero_power_gained
    )
    VALUES (
        v_student_id,
        CURRENT_DATE,
        true,
        COALESCE(NEW.duration_minutes, NEW.duration, 0),
        2
    )
    ON CONFLICT (student_id, log_date)
    DO UPDATE SET
        studied_today = true,
        minutes_studied = journey_logs.minutes_studied + COALESCE(NEW.duration_minutes, NEW.duration, 0),
        hero_power_gained = journey_logs.hero_power_gained + 2;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for hero journey updates
CREATE TRIGGER update_hero_journey_after_study
    AFTER INSERT OR UPDATE OF status ON study_sessions
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION update_hero_journey_on_study();

-- Function to handle missed days (shadow grows)
CREATE OR REPLACE FUNCTION check_missed_study_days()
RETURNS void AS $$
DECLARE
    v_student RECORD;
    v_last_study DATE;
    v_streak INTEGER;
    v_shadow_level INTEGER;
BEGIN
    -- Check all students
    FOR v_student IN 
        SELECT id, current_streak, last_login 
        FROM students 
        WHERE current_streak > 0
    LOOP
        -- Find last study session date
        SELECT MAX(DATE(started_at)) INTO v_last_study
        FROM study_sessions
        WHERE student_id = v_student.id
        AND status = 'completed';
        
        -- If no study today and streak was active yesterday
        IF v_last_study < CURRENT_DATE - 1 THEN
            -- Calculate shadow growth
            v_shadow_level := calculate_shadow_doom(v_last_study, 0, true);
            
            -- Update journey with shadow growth
            UPDATE hero_journeys
            SET shadow_doom_level = v_shadow_level,
                shadow_doom_active = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE student_id = v_student.id;
            
            -- Log shadow event
            INSERT INTO narrative_events (
                student_id,
                event_type,
                event_title,
                event_description,
                shadow_doom_change
            )
            VALUES (
                v_student.id,
                'shadow_attack',
                'The Shadow Grows',
                'You missed a study day. The Shadow of Doom grows stronger!',
                10
            );
        END IF;
    END LOOP;
END;
$$ language 'plpgsql';

-- ============================================
-- VIEWS FOR JOURNEY ANALYTICS
-- ============================================

-- Hero journey summary view
CREATE VIEW hero_journey_summary AS
SELECT 
    hj.student_id,
    s.username,
    s.full_name,
    s.current_streak,
    hj.hero_power,
    hj.shadow_doom_level,
    hj.shadow_doom_active,
    hj.current_stage,
    js.title as current_stage_title,
    js.description as current_stage_description,
    hj.longest_streak_achieved,
    hj.chosen_path
FROM hero_journeys hj
JOIN students s ON hj.student_id = s.id
LEFT JOIN journey_stages js ON hj.current_stage = js.stage_number;

-- Daily journey stats view
CREATE VIEW daily_journey_stats AS
SELECT 
    jl.student_id,
    jl.log_date,
    jl.studied_today,
    jl.minutes_studied,
    jl.hero_power_gained,
    jl.shadow_grew,
    jl.milestone_reached,
    s.current_streak
FROM journey_logs jl
JOIN students s ON jl.student_id = s.id
ORDER BY jl.log_date DESC;

-- ============================================
-- SEED NARRATIVE MESSAGES
-- ============================================

-- Create a table for narrative messages
CREATE TABLE narrative_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_type VARCHAR(50) NOT NULL, -- 'hero_power_up', 'shadow_warning', 'streak_milestone', 'daily_encouragement'
    condition_min INTEGER DEFAULT 0,
    condition_max INTEGER DEFAULT 999,
    message TEXT NOT NULL,
    tone VARCHAR(20) DEFAULT 'encouraging' -- 'encouraging', 'warning', 'celebratory'
);

-- Insert narrative messages
INSERT INTO narrative_messages (message_type, condition_min, condition_max, message, tone) VALUES
-- Hero power up messages
('hero_power_up', 10, 20, 'Your inner light grows brighter!', 'celebratory'),
('hero_power_up', 21, 40, 'You are becoming a true Scholar Warrior!', 'celebratory'),
('hero_power_up', 41, 60, 'The Shadow fears your dedication!', 'celebratory'),
('hero_power_up', 61, 80, 'You are a beacon of focus in the darkness!', 'celebratory'),
('hero_power_up', 81, 100, 'LEGENDARY POWER! The Procrastination Prophecy trembles!', 'celebratory'),

-- Shadow warning messages
('shadow_warning', 1, 20, 'The Shadow is watching... but you are stronger.', 'warning'),
('shadow_warning', 21, 50, 'The Shadow grows restless. Do not let it win!', 'warning'),
('shadow_warning', 51, 75, 'The Shadow of Doom approaches! Study to push it back!', 'warning'),
('shadow_warning', 76, 100, 'DANGER! The Shadow threatens to consume your progress!', 'warning'),

-- Streak milestone messages
('streak_milestone', 3, 3, '3 days! Your flame burns steady!', 'celebratory'),
('streak_milestone', 7, 7, 'ONE WEEK! You have unlocked Guardian status!', 'celebratory'),
('streak_milestone', 14, 14, 'Two weeks! The Shadow retreats before your power!', 'celebratory'),
('streak_milestone', 30, 30, 'ONE MONTH! You are writing your own legend!', 'celebratory'),

-- Daily encouragement
('daily_encouragement', 0, 0, 'Today is a new chance to grow stronger!', 'encouraging'),
('daily_encouragement', 0, 0, 'Every study session makes you a hero!', 'encouraging'),
('daily_encouragement', 0, 0, 'The Path of the Scholar awaits your next step.', 'encouraging'),
('daily_encouragement', 0, 0, 'Your future self thanks you for studying today.', 'encouraging'),
('daily_encouragement', 0, 0, 'Small steps lead to legendary journeys!', 'encouraging');

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE hero_journeys IS 'Tracks student progress in The Procrastination Prophecy meta-narrative';
COMMENT ON TABLE journey_stages IS 'Defines the 10 stages of the hero journey';
COMMENT ON TABLE journey_logs IS 'Daily study logs with narrative context';
COMMENT ON TABLE narrative_events IS 'Records story events in the meta-narrative';
COMMENT ON TABLE narrative_messages IS 'Dynamic messages based on hero/shadow state';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'The Procrastination Prophecy migration applied successfully! ???”ï???' as message;
-- Create dedicated schedule table
CREATE TABLE IF NOT EXISTS student_schedules (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  is_rest_day BOOLEAN DEFAULT FALSE,
  study_start_time TIME,
  study_end_time TIME,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, day_of_week)
);

-- Add role column to students if not exists
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';

-- Insert default schedule for existing students (Monday-Saturday study, Sunday rest)
INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 0, TRUE FROM students WHERE role = 'student' OR role IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 1, FALSE FROM students WHERE role = 'student' OR role IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 2, FALSE FROM students WHERE role = 'student' OR role IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 3, FALSE FROM students WHERE role = 'student' OR role IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 4, FALSE FROM students WHERE role = 'student' OR role IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 5, FALSE FROM students WHERE role = 'student' OR role IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 6, FALSE FROM students WHERE role = 'student' OR role IS NULL
ON CONFLICT DO NOTHING;

-- Add onboarding and schedule columns to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS form_level VARCHAR(10),
ADD COLUMN IF NOT EXISTS age_tier VARCHAR(10) DEFAULT 'P4-P6',
ADD COLUMN IF NOT EXISTS daily_time_limit_minutes INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Optional: Update existing students to mark them as needing onboarding
-- UPDATE students SET onboarding_completed = FALSE WHERE form_level IS NULL;
-- ============================================
-- Migration: Revision Mode - Document-based learning
-- ============================================

-- ============================================
-- REVISION DOCUMENTS TABLE
-- ============================================
CREATE TABLE revision_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- File info
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    
    -- Content
    content TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_revision_documents_user ON revision_documents(user_id);
CREATE INDEX idx_revision_documents_created ON revision_documents(created_at);

-- ============================================
-- REVISION QUIZZES TABLE
-- ============================================
CREATE TABLE revision_quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES revision_documents(id) ON DELETE CASCADE,
    
    -- Quiz content
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    key_concepts JSONB DEFAULT '[]',
    questions JSONB NOT NULL,
    
    -- Stats
    times_taken INTEGER DEFAULT 0,
    average_score DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_revision_quizzes_user ON revision_quizzes(user_id);
CREATE INDEX idx_revision_quizzes_document ON revision_quizzes(document_id);

-- ============================================
-- QUIZ ATTEMPTS TABLE
-- ============================================
CREATE TABLE revision_quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES revision_quizzes(id) ON DELETE CASCADE,
    
    -- Results
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    answers JSONB NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quiz_attempts_user ON revision_quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON revision_quiz_attempts(quiz_id);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================
CREATE TRIGGER update_revision_documents_updated_at 
    BEFORE UPDATE ON revision_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_revision_quizzes_updated_at 
    BEFORE UPDATE ON revision_quizzes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE revision_documents IS 'Stores uploaded documents for revision mode';
COMMENT ON TABLE revision_quizzes IS 'Quizzes generated from uploaded documents';
COMMENT ON TABLE revision_quiz_attempts IS 'Tracks quiz attempts by users';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Revision mode migration applied successfully! ???? as message;
-- Table to store learning schedules/curricula
CREATE TABLE IF NOT EXISTS learning_schedules (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_chapters INTEGER DEFAULT 0,
  total_estimated_minutes INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft', -- draft, active, completed, paused
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE(student_id, subject, status) -- One active schedule per subject
);

-- Table to store chapters within a schedule
CREATE TABLE IF NOT EXISTS schedule_chapters (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES learning_schedules(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  estimated_minutes INTEGER DEFAULT 15,
  status VARCHAR(20) DEFAULT 'locked', -- locked, available, in_progress, completed
  order_index INTEGER NOT NULL,
  is_skipped BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table to store concepts/topics within each chapter
CREATE TABLE IF NOT EXISTS chapter_concepts (
  id SERIAL PRIMARY KEY,
  chapter_id INTEGER REFERENCES schedule_chapters(id) ON DELETE CASCADE,
  concept_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  key_points TEXT[], -- Array of key learning points
  estimated_minutes INTEGER DEFAULT 5,
  status VARCHAR(20) DEFAULT 'locked', -- locked, available, completed
  order_index INTEGER NOT NULL,
  is_skipped BOOLEAN DEFAULT FALSE,
  mastery_score INTEGER DEFAULT 0,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_learning_schedules_student ON learning_schedules(student_id);
CREATE INDEX IF NOT EXISTS idx_schedule_chapters_schedule ON schedule_chapters(schedule_id);
CREATE INDEX IF NOT EXISTS idx_chapter_concepts_chapter ON chapter_concepts(chapter_id);
-- ============================================
-- Comprehensive Features Migration
-- Progress, Goals, Rewards, Analytics, Study Groups, Challenges
-- ============================================

-- ============================================
-- 1. PROGRESS MONITORING & GOALS
-- ============================================

-- Student goals table
CREATE TABLE IF NOT EXISTS student_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    
    -- Goal Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    goal_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'subject', 'skill'
    target_metric VARCHAR(50) NOT NULL, -- 'minutes', 'sessions', 'xp', 'streak', 'accuracy'
    target_value INTEGER NOT NULL,
    current_value INTEGER DEFAULT 0,
    
    -- Subject/Topic specific (optional)
    subject VARCHAR(100),
    topic VARCHAR(255),
    
    -- Timeframe
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'abandoned'
    progress_percentage INTEGER DEFAULT 0,
    
    -- Reward
    reward_xp INTEGER DEFAULT 0,
    reward_badge VARCHAR(100),
    
    -- Parent/Teacher involvement
    created_by UUID,
    is_approved BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_student_goals_student ON student_goals(student_id);
CREATE INDEX IF NOT EXISTS idx_student_goals_status ON student_goals(status);
CREATE INDEX IF NOT EXISTS idx_student_goals_type ON student_goals(goal_type);

-- Progress tracking table (detailed daily/weekly progress)
CREATE TABLE IF NOT EXISTS progress_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    
    -- Time period
    tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tracking_week INTEGER, -- ISO week number
    tracking_month INTEGER,
    tracking_year INTEGER,
    
    -- Study metrics
    total_minutes INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_xp_earned INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    accuracy_rate DECIMAL(5,2),
    
    -- Subject breakdown (JSON)
    subject_breakdown JSONB DEFAULT '{}',
    
    -- Skill progression
    skills_improved JSONB DEFAULT '[]',
    
    -- Comparisons
    vs_last_week DECIMAL(5,2),
    vs_average DECIMAL(5,2),
    
    UNIQUE(student_id, tracking_date),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_progress_tracking_student_date ON progress_tracking(student_id, tracking_date);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_week ON progress_tracking(tracking_year, tracking_week);

-- ============================================
-- 2. PARENT-TEACHER COLLABORATION ON REWARDS
-- ============================================

-- Reward definitions (created by parents/teachers)
CREATE TABLE IF NOT EXISTS reward_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID NOT NULL,
    creator_role VARCHAR(20) NOT NULL, -- 'parent', 'teacher', 'self'
    
    -- Reward Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reward_type VARCHAR(50) NOT NULL, -- 'digital_badge', 'real_reward', 'privilege', 'activity'
    
    -- Requirements to unlock
    requirement_type VARCHAR(50), -- 'goal_completion', 'streak', 'xp_threshold', 'custom'
    requirement_value INTEGER,
    requirement_description TEXT,
    
    -- Visual
    icon VARCHAR(10) DEFAULT '??',
    color VARCHAR(20) DEFAULT 'gold',
    
    -- For real rewards
    reward_value VARCHAR(100), -- e.g., "$50", "Movie night"
    delivery_method TEXT, -- How to deliver the reward
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES students(id) ON DELETE CASCADE
);

-- Student rewards (earned/unlocked)
CREATE TABLE IF NOT EXISTS student_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    reward_id UUID,
    
    -- Reward copy (in case definition changes)
    reward_title VARCHAR(255),
    reward_description TEXT,
    reward_type VARCHAR(50),
    
    -- Status
    status VARCHAR(20) DEFAULT 'locked', -- 'locked', 'unlocked', 'claimed', 'delivered'
    progress_percentage INTEGER DEFAULT 0,
    
    -- Unlock details
    unlocked_at TIMESTAMP WITH TIME ZONE,
    unlocked_by_goal UUID,
    
    -- Claim details
    claimed_at TIMESTAMP WITH TIME ZONE,
    claimed_by UUID, -- Parent who approved
    claim_notes TEXT,
    
    -- Delivery tracking (for real rewards)
    delivery_status VARCHAR(20), -- 'pending', 'shipped', 'delivered', 'redeemed'
    delivery_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES reward_definitions(id) ON DELETE SET NULL,
    FOREIGN KEY (claimed_by) REFERENCES students(id),
    FOREIGN KEY (unlocked_by_goal) REFERENCES student_goals(id)
);

CREATE INDEX IF NOT EXISTS idx_student_rewards_student ON student_rewards(student_id);
CREATE INDEX IF NOT EXISTS idx_student_rewards_status ON student_rewards(status);

-- Reward collaborations (parents and teachers collaborating)
CREATE TABLE IF NOT EXISTS reward_collaborations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reward_id UUID NOT NULL,
    collaborator_id UUID NOT NULL,
    collaborator_role VARCHAR(20) NOT NULL, -- 'parent', 'teacher'
    
    -- Permissions
    can_edit BOOLEAN DEFAULT FALSE,
    can_approve_claims BOOLEAN DEFAULT TRUE,
    can_view_progress BOOLEAN DEFAULT TRUE,
    
    -- Notification preferences
    notify_on_unlock BOOLEAN DEFAULT TRUE,
    notify_on_claim BOOLEAN DEFAULT TRUE,
    
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(reward_id, collaborator_id),
    FOREIGN KEY (reward_id) REFERENCES reward_definitions(id) ON DELETE CASCADE,
    FOREIGN KEY (collaborator_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 3. AI CONVERSATION REVIEW
-- ============================================

-- AI conversation history (for parents/teachers to review)
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    
    -- Conversation metadata
    session_id VARCHAR(100), -- Group messages by session
    conversation_type VARCHAR(50) DEFAULT 'study_buddy', -- 'study_buddy', 'tutor', 'story_quest'
    
    -- Message content
    message_role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    message_content TEXT NOT NULL,
    message_metadata JSONB DEFAULT '{}', -- Contains thinking, citations, etc.
    
    -- Context at time of conversation
    student_context JSONB DEFAULT '{}', -- { level, xp, streak, subject }
    
    -- Review status
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_student ON ai_conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_type ON ai_conversations(conversation_type);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_flagged ON ai_conversations(is_flagged) WHERE is_flagged = TRUE;

-- Conversation review permissions
CREATE TABLE IF NOT EXISTS conversation_reviewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    reviewer_role VARCHAR(20) NOT NULL, -- 'parent', 'teacher'
    
    -- Permissions
    can_view_all BOOLEAN DEFAULT TRUE,
    can_flag_conversations BOOLEAN DEFAULT TRUE,
    can_add_notes BOOLEAN DEFAULT TRUE,
    receive_alerts BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(student_id, reviewer_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 4. TEACHER MODULE - CLASS MANAGEMENT
-- ============================================

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL,
    
    -- Class Details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100),
    grade_level VARCHAR(20),
    
    -- Settings
    class_code VARCHAR(20) UNIQUE, -- For students to join
    is_active BOOLEAN DEFAULT TRUE,
    max_students INTEGER DEFAULT 30,
    
    -- Schedule
    start_date DATE,
    end_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (teacher_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_code ON classes(class_code);

-- Class students (junction table)
CREATE TABLE IF NOT EXISTS class_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'removed'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance tracking
    overall_grade VARCHAR(5),
    attendance_rate DECIMAL(5,2),
    
    UNIQUE(class_id, student_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_class_students_class ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);

-- Class challenges
CREATE TABLE IF NOT EXISTS class_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL,
    created_by UUID NOT NULL,
    
    -- Challenge Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    challenge_type VARCHAR(50), -- 'study_time', 'accuracy', 'streak', 'completion'
    
    -- Requirements
    target_metric VARCHAR(50),
    target_value INTEGER,
    time_limit_hours INTEGER, -- 0 for no limit
    
    -- Rewards
    xp_reward INTEGER DEFAULT 0,
    badge_reward VARCHAR(100),
    
    -- Status
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    
    -- Results
    winner_id UUID,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES students(id),
    FOREIGN KEY (winner_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_class_challenges_class ON class_challenges(class_id);
CREATE INDEX IF NOT EXISTS idx_class_challenges_status ON class_challenges(status);

-- Challenge participants progress
CREATE TABLE IF NOT EXISTS challenge_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Progress
    current_value INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    rank INTEGER,
    
    -- Status
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(challenge_id, student_id),
    FOREIGN KEY (challenge_id) REFERENCES class_challenges(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 5. STUDENT ANALYTICS FOR TEACHERS
-- ============================================

-- Aggregated analytics view (materialized view would be better for performance)
CREATE TABLE IF NOT EXISTS student_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    class_id UUID,
    
    -- Time period
    analytics_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_type VARCHAR(20) NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    
    -- Study metrics
    total_study_minutes INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    avg_session_duration INTEGER DEFAULT 0,
    
    -- Performance metrics
    questions_attempted INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    accuracy_rate DECIMAL(5,2),
    
    -- Engagement
    login_count INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE,
    
    -- Skill breakdown
    strong_skills JSONB DEFAULT '[]',
    weak_skills JSONB DEFAULT '[]',
    skill_progression JSONB DEFAULT '{}',
    
    -- Comparisons
    class_rank INTEGER,
    class_average_comparison DECIMAL(5,2), -- percentage above/below average
    
    -- AI Tutor usage
    ai_conversations_count INTEGER DEFAULT 0,
    avg_conversation_length INTEGER DEFAULT 0,
    
    -- Flags for teacher attention
    needs_attention BOOLEAN DEFAULT FALSE,
    attention_reasons JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(student_id, teacher_id, analytics_date, period_type),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_student_analytics_student ON student_analytics(student_id);
CREATE INDEX IF NOT EXISTS idx_student_analytics_teacher ON student_analytics(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_analytics_class ON student_analytics(class_id);
CREATE INDEX IF NOT EXISTS idx_student_analytics_attention ON student_analytics(needs_attention) WHERE needs_attention = TRUE;

-- ============================================
-- 6. SESSION VERIFICATION
-- ============================================

-- Session verification (for teachers to verify study sessions)
CREATE TABLE IF NOT EXISTS session_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Verification status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected', 'auto_verified'
    
    -- Verification methods
    verified_by UUID, -- Teacher/parent who verified
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_method VARCHAR(50), -- 'manual', 'auto_ai', 'parent_confirm', 'peer_confirm'
    
    -- Evidence
    screenshot_url TEXT,
    notes TEXT,
    ai_confidence_score DECIMAL(5,2), -- AI analysis confidence
    
    -- Rejection details
    rejection_reason TEXT,
    rejected_by UUID,
    rejected_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES students(id),
    FOREIGN KEY (rejected_by) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_session_verifications_session ON session_verifications(session_id);
CREATE INDEX IF NOT EXISTS idx_session_verifications_status ON session_verifications(status);
CREATE INDEX IF NOT EXISTS idx_session_verifications_student ON session_verifications(student_id);

-- ============================================
-- 7. STUDY GROUPS
-- ============================================

-- Study groups
CREATE TABLE IF NOT EXISTS study_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Settings
    is_private BOOLEAN DEFAULT FALSE,
    join_code VARCHAR(20) UNIQUE,
    max_members INTEGER DEFAULT 10,
    
    -- Focus
    subject VARCHAR(100),
    topics JSONB DEFAULT '[]',
    
    -- Created by
    creator_id UUID NOT NULL,
    
    -- Stats
    total_study_minutes INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (creator_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_study_groups_creator ON study_groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_study_groups_subject ON study_groups(subject);

-- Group members
CREATE TABLE IF NOT EXISTS study_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Role
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member', 'moderator'
    
    -- Stats
    contribution_minutes INTEGER DEFAULT 0,
    contribution_sessions INTEGER DEFAULT 0,
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(group_id, student_id),
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_study_group_members_group ON study_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_study_group_members_student ON study_group_members(student_id);

-- Group study sessions
CREATE TABLE IF NOT EXISTS group_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL,
    created_by UUID NOT NULL,
    
    -- Session details
    title VARCHAR(255),
    description TEXT,
    subject VARCHAR(100),
    
    -- Schedule
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'cancelled'
    
    -- Participants
    participant_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES students(id)
);

-- Group session participants
CREATE TABLE IF NOT EXISTS group_session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    study_minutes INTEGER DEFAULT 0,
    
    UNIQUE(session_id, student_id),
    FOREIGN KEY (session_id) REFERENCES group_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 8. FRIENDS SYSTEM
-- ============================================

-- Friend connections
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL,
    addressee_id UUID NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'blocked', 'declined'
    
    -- Stats
    shared_study_minutes INTEGER DEFAULT 0,
    shared_sessions INTEGER DEFAULT 0,
    
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(requester_id, addressee_id),
    FOREIGN KEY (requester_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- Friend activity feed
CREATE TABLE IF NOT EXISTS friend_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    
    -- Activity details
    activity_type VARCHAR(50) NOT NULL, -- 'session_complete', 'goal_achieved', 'level_up', 'badge_earned', 'challenge_won'
    activity_data JSONB DEFAULT '{}',
    
    -- Visibility
    is_public BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_friend_activities_student ON friend_activities(student_id);
CREATE INDEX IF NOT EXISTS idx_friend_activities_created ON friend_activities(created_at);

-- ============================================
-- 9. CHALLENGES SYSTEM
-- ============================================

-- Challenges (global and personal)
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Creator (NULL for system challenges)
    created_by UUID,
    creator_type VARCHAR(20) DEFAULT 'system', -- 'system', 'teacher', 'parent', 'student'
    
    -- Challenge details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    challenge_type VARCHAR(50) NOT NULL, -- 'personal', 'friend', 'group', 'class', 'global'
    category VARCHAR(50), -- 'study_time', 'accuracy', 'streak', 'completion', 'speed'
    
    -- Requirements
    target_metric VARCHAR(50) NOT NULL,
    target_value INTEGER NOT NULL,
    time_limit_days INTEGER, -- NULL for no limit
    
    -- Difficulty
    difficulty VARCHAR(20) DEFAULT 'medium', -- 'easy', 'medium', 'hard', 'expert'
    
    -- Rewards
    xp_reward INTEGER DEFAULT 0,
    badge_id UUID,
    
    -- Availability
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Scope
    class_id UUID,
    group_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES students(id) ON DELETE SET NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE
);

-- Challenge participants
CREATE TABLE IF NOT EXISTS challenge_participants_all (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Progress
    current_value INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    rank INTEGER,
    
    -- Status
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    reward_claimed BOOLEAN DEFAULT FALSE,
    reward_claimed_at TIMESTAMP WITH TIME ZONE,
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(challenge_id, student_id),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 10. SCHEDULE OPTIMIZER
-- ============================================

-- Optimal study schedules (AI-generated)
CREATE TABLE IF NOT EXISTS optimized_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    
    -- Schedule details
    schedule_name VARCHAR(255) DEFAULT 'Optimized Schedule',
    generated_by VARCHAR(50) DEFAULT 'ai', -- 'ai', 'teacher', 'self'
    
    -- Input parameters
    input_preferences JSONB DEFAULT '{}', -- { preferred_times, subjects_focus, goals }
    
    -- The optimized schedule
    schedule_data JSONB NOT NULL, -- Array of { day, time_slots: [{ start, end, subject, activity, reason }] }
    
    -- AI explanation
    optimization_reasoning TEXT,
    expected_outcomes JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_accepted BOOLEAN DEFAULT FALSE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance tracking
    adherence_rate DECIMAL(5,2),
    effectiveness_score DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Schedule adherence tracking
CREATE TABLE IF NOT EXISTS schedule_adherence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL,
    student_id UUID NOT NULL,
    
    -- Planned vs Actual
    planned_date DATE NOT NULL,
    planned_slot JSONB NOT NULL,
    actual_session_id UUID,
    
    -- Adherence
    followed BOOLEAN DEFAULT FALSE,
    deviation_minutes INTEGER DEFAULT 0,
    deviation_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (schedule_id) REFERENCES optimized_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (actual_session_id) REFERENCES study_sessions(id) ON DELETE SET NULL
);

-- ============================================
-- 11. TEACHER ANALYTICS DASHBOARD
-- ============================================

-- Class overview analytics
CREATE TABLE IF NOT EXISTS class_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL,
    
    -- Time period
    analytics_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_type VARCHAR(20) NOT NULL DEFAULT 'daily',
    
    -- Class metrics
    total_students INTEGER DEFAULT 0,
    active_students INTEGER DEFAULT 0, -- Students who studied today
    
    -- Aggregate study metrics
    total_study_minutes INTEGER DEFAULT 0,
    avg_study_minutes_per_student INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    
    -- Performance
    avg_accuracy_rate DECIMAL(5,2),
    completion_rate DECIMAL(5,2),
    
    -- Engagement
    avg_session_duration INTEGER DEFAULT 0,
    most_active_hour INTEGER,
    
    -- Subject breakdown
    subject_breakdown JSONB DEFAULT '{}',
    
    -- Top performers & needs attention
    top_performers JSONB DEFAULT '[]',
    needs_attention JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_student_goals_updated_at ON student_goals;
CREATE TRIGGER update_student_goals_updated_at 
    BEFORE UPDATE ON student_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at 
    BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_study_groups_updated_at ON study_groups;
CREATE TRIGGER update_study_groups_updated_at 
    BEFORE UPDATE ON study_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_optimized_schedules_updated_at ON optimized_schedules;
CREATE TRIGGER update_optimized_schedules_updated_at 
    BEFORE UPDATE ON optimized_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 12. NEW ACHIEVEMENTS
-- ============================================

INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value, points_reward, badge_tier) VALUES
-- Social achievements
('Social Scholar', 'Join your first study group', '?‘¥', 'social', 'study_groups_joined', 1, 50, 'bronze'),
('Group Leader', 'Create a study group', '??', 'social', 'study_groups_created', 1, 100, 'bronze'),
('Team Player', 'Study 10 hours in group sessions', '??', 'social', 'group_study_minutes', 600, 200, 'silver'),
('Popular Student', 'Make 5 friends', '?¤ï?', 'social', 'friends_count', 5, 100, 'bronze'),

-- Challenge achievements
('Challenge Accepted', 'Complete your first challenge', '?Ž¯', 'challenges', 'challenges_completed', 1, 50, 'bronze'),
('Challenge Champion', 'Complete 10 challenges', '??', 'challenges', 'challenges_completed', 10, 300, 'silver'),
('Speed Demon', 'Complete a speed challenge', '??, 'challenges', 'speed_challenges', 1, 100, 'bronze'),

-- Goal achievements
('Goal Setter', 'Create your first goal', '??', 'goals', 'goals_created', 1, 25, 'bronze'),
('Goal Crusher', 'Complete 5 goals', '??, 'goals', 'goals_completed', 5, 150, 'silver'),
('Overachiever', 'Exceed a goal by 50%', '??', 'goals', 'goals_exceeded', 1, 200, 'silver'),

-- Teacher/Class achievements
('Class Champion', 'Rank #1 in your class', '??', 'class', 'class_rank', 1, 300, 'gold'),
('Teacher''s Pet', 'Be verified by teacher 10 times', '?”ï?', 'class', 'teacher_verifications', 10, 100, 'bronze'),
('Study Star', 'Be in top 3 of class for a week', 'â­?, 'class', 'top_three_week', 1, 200, 'silver'),

-- Schedule achievements
('Schedule Master', 'Follow optimized schedule for 7 days', '??', 'schedule', 'schedule_adherence', 7, 150, 'bronze'),
('Consistency King', '30 days of schedule adherence', '??', 'schedule', 'schedule_adherence', 30, 500, 'gold')
ON CONFLICT (name) DO NOTHING;

-- Success message
SELECT 'Comprehensive features migration completed successfully! ???? as message;
-- ============================================
-- Fix Role Constraint - Add 'teacher' to valid roles
-- ============================================

-- First, drop the existing constraint if it exists
ALTER TABLE students DROP CONSTRAINT IF EXISTS valid_role;

-- Add the role column if it doesn't exist (should already exist)
ALTER TABLE students ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';

-- Add a new constraint that includes 'teacher'
ALTER TABLE students ADD CONSTRAINT valid_role CHECK (role IN ('student', 'parent', 'teacher'));

-- Set default value for any NULL roles
UPDATE students SET role = 'student' WHERE role IS NULL;

-- Make role NOT NULL
ALTER TABLE students ALTER COLUMN role SET NOT NULL;

SELECT 'Role constraint fixed! Now supports: student, parent, teacher' as message;
-- Add media column to ai_conversations table
ALTER TABLE ai_conversations 
ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]';

-- Create index for media queries
CREATE INDEX IF NOT EXISTS idx_ai_conversations_media ON ai_conversations USING GIN(media);
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
-- Get ALL tables in your Supabase project
SELECT *
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'students' 
ORDER BY table_name;
