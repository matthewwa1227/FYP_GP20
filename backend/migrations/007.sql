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