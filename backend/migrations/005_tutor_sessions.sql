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