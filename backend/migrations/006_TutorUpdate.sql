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