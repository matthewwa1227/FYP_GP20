-- Create dedicated schedule table
CREATE TABLE student_schedules (
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

-- Insert default schedule for existing students (Monday-Saturday study, Sunday rest)
INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 0, TRUE FROM students WHERE role = 'student'
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 1, FALSE FROM students WHERE role = 'student'
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 2, FALSE FROM students WHERE role = 'student'
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 3, FALSE FROM students WHERE role = 'student'
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 4, FALSE FROM students WHERE role = 'student'
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 5, FALSE FROM students WHERE role = 'student'
ON CONFLICT DO NOTHING;

INSERT INTO student_schedules (student_id, day_of_week, is_rest_day)
SELECT id, 6, FALSE FROM students WHERE role = 'student'
ON CONFLICT DO NOTHING;