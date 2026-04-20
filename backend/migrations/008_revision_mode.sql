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


COMMENT ON TABLE revision_documents IS 'Stores uploaded documents for revision mode';
COMMENT ON TABLE revision_quizzes IS 'Quizzes generated from uploaded documents';
COMMENT ON TABLE revision_quiz_attempts IS 'Tracks quiz attempts by users';

