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
SELECT 'The Procrastination Prophecy migration applied successfully! 🌟⚔️🌑' as message;
