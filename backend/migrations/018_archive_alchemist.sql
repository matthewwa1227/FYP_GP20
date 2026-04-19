-- ============================================
-- Migration 018: Archive Alchemist - Document Ingestion Portal
-- ============================================

-- ============================================
-- ARCHIVE SESSIONS TABLE
-- Stores document uploads and AI-generated study notes
-- ============================================
CREATE TABLE IF NOT EXISTS archive_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- Source info
    title TEXT NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('upload', 'url')),
    source_url TEXT,
    filename TEXT,
    original_name TEXT,
    mime_type VARCHAR(100),

    -- Extracted content
    original_text TEXT,
    word_count INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0,

    -- Generated content (AI transmutation output)
    generated_notes JSONB DEFAULT '{}',
    flashcards JSONB DEFAULT '[]',
    summary TEXT,
    master_artifact JSONB DEFAULT '{}',

    -- Status tracking
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    error_message TEXT,

    -- Gamification
    xp_earned INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_archive_sessions_user ON archive_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_archive_sessions_status ON archive_sessions(status);
CREATE INDEX IF NOT EXISTS idx_archive_sessions_created ON archive_sessions(created_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_archive_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_archive_sessions_updated_at ON archive_sessions;
CREATE TRIGGER update_archive_sessions_updated_at
    BEFORE UPDATE ON archive_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_archive_sessions_updated_at();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Archive Alchemist migration applied successfully! 📜✨' as message;
