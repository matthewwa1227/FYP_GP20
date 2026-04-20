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

