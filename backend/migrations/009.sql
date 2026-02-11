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