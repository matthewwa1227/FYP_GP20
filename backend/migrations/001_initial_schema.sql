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