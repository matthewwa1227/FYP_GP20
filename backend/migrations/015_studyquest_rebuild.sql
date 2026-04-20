
-- ============================================
-- 1. PROJECTS (Learning Paths)
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    deliverable TEXT, -- e.g., "Working fitness dashboard script"
    topic TEXT NOT NULL, -- e.g., "Python for Fitness Analysis"
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'paused')),
    current_chapter INTEGER DEFAULT 1,
    skill_tree JSONB DEFAULT '[]', -- Array of skill nodes with prerequisites
    confidence_score INTEGER DEFAULT 0, -- 0-100, determines boss battle recommendation
    total_chapters INTEGER DEFAULT 0,
    completed_chapters INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for user project lookups
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================
-- 2. CHAPTERS (Individual Learning Units)
-- ============================================
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    focus_area TEXT, -- e.g., "CSV Reading", "Data Cleaning"
    context TEXT, -- Real-world scenario setup
    content JSONB NOT NULL DEFAULT '{}', -- { keyPoints: [], fullLesson: '', whyItMatters: '' }
    status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
    prerequisites UUID[] DEFAULT '{}', -- Array of chapter IDs that must be completed first
    estimated_minutes INTEGER DEFAULT 15,
    difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    question_count INTEGER DEFAULT 0,
    completed_questions INTEGER DEFAULT 0,
    artifact_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(project_id, chapter_number)
);

-- Indexes for chapter lookups
CREATE INDEX idx_chapters_project_id ON chapters(project_id);
CREATE INDEX idx_chapters_status ON chapters(status);
CREATE INDEX idx_chapters_prerequisites ON chapters USING GIN(prerequisites);

-- ============================================
-- 3. KNOWLEDGE ARTIFACTS (User's Reference Library)
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    title TEXT NOT NULL, -- e.g., "CSV Reading Cheat Sheet"
    content TEXT NOT NULL, -- Markdown content
    summary TEXT, -- Quick summary for preview
    tags TEXT[] DEFAULT '{}', -- e.g., ["python", "csv", "pandas"]
    searchable_text TSVECTOR, -- For full-text search
    pin_order INTEGER DEFAULT 0, -- 0 = not pinned, >0 = pin priority
    view_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for artifact lookups
CREATE INDEX idx_artifacts_user_id ON knowledge_artifacts(user_id);
CREATE INDEX idx_artifacts_project_id ON knowledge_artifacts(project_id);
CREATE INDEX idx_artifacts_chapter_id ON knowledge_artifacts(chapter_id);
CREATE INDEX idx_artifacts_search ON knowledge_artifacts USING GIN(searchable_text);
CREATE INDEX idx_artifacts_tags ON knowledge_artifacts USING GIN(tags);

-- Trigger to auto-update searchable_text
CREATE OR REPLACE FUNCTION update_artifact_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.searchable_text := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artifact_search ON knowledge_artifacts;
CREATE TRIGGER trigger_update_artifact_search
    BEFORE INSERT OR UPDATE ON knowledge_artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_artifact_search_vector();

-- ============================================
-- 4. QUESTIONS (Mixed Types)
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL CHECK (question_type IN (
        'code_execution',
        'fill_blank',
        'error_analysis',
        'concept_synthesis',
        'multiple_choice',
        'debugging',
        'prediction'
    )),
    question_data JSONB NOT NULL, -- Type-specific structure
    correct_answer JSONB NOT NULL,
    ai_explanation TEXT, -- Detailed explanation of correct answer
    hint TEXT, -- Subtle hint without giving answer
    difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    order_index INTEGER DEFAULT 0,
    estimated_time_seconds INTEGER DEFAULT 120,
    requires_artifact BOOLEAN DEFAULT FALSE, -- If true, user should reference artifacts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for question lookups
CREATE INDEX idx_questions_chapter_id ON questions(chapter_id);
CREATE INDEX idx_questions_type ON questions(question_type);
CREATE INDEX idx_questions_order ON questions(chapter_id, order_index);

-- ============================================
-- 5. QUESTION ATTEMPTS (Track All Tries with Diagnostics)
-- ============================================
CREATE TABLE IF NOT EXISTS question_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_answer JSONB NOT NULL,
    is_correct BOOLEAN NOT NULL,
    ai_diagnosis TEXT, -- "You used fillna(0) which creates false health data"
    misconception_tag TEXT, -- "missing_null_handling", "syntax_error", etc.
    time_spent_seconds INTEGER DEFAULT 0,
    artifacts_referenced UUID[] DEFAULT '{}', -- Which artifacts user checked
    attempt_number INTEGER DEFAULT 1,
    was_diagnosed BOOLEAN DEFAULT FALSE, -- Whether AI diagnosis was provided
    retry_after_diagnosis BOOLEAN DEFAULT FALSE, -- Whether this was a retry
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for attempt lookups
CREATE INDEX idx_attempts_user_id ON question_attempts(user_id);
CREATE INDEX idx_attempts_question_id ON question_attempts(question_id);
CREATE INDEX idx_attempts_chapter_id ON question_attempts(chapter_id);
CREATE INDEX idx_attempts_project_id ON question_attempts(project_id);
CREATE INDEX idx_attempts_correct ON question_attempts(is_correct);
CREATE INDEX idx_attempts_created ON question_attempts(created_at DESC);

-- ============================================
-- 6. BOSS BATTLES (Multi-Stage Synthesis)
-- ============================================
CREATE TABLE IF NOT EXISTS boss_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    scenario TEXT, -- Real-world scenario for the battle
    deliverable TEXT, -- What the user must create
    stages JSONB NOT NULL DEFAULT '[]', -- Array of stage configurations
    status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'in_progress', 'completed', 'failed')),
    current_stage INTEGER DEFAULT 1,
    total_stages INTEGER DEFAULT 3,
    confidence_threshold INTEGER DEFAULT 70, -- Minimum confidence to unlock
    completed_stages INTEGER[] DEFAULT '{}', -- Which stages are done
    failed_stages INTEGER[] DEFAULT '{}', -- Which stages failed
    badge_earned TEXT, -- Badge name on completion
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(project_id, user_id)
);

-- Indexes for boss battle lookups
CREATE INDEX idx_boss_battles_project_id ON boss_battles(project_id);
CREATE INDEX idx_boss_battles_user_id ON boss_battles(user_id);
CREATE INDEX idx_boss_battles_status ON boss_battles(status);

-- ============================================
-- 7. BOSS STAGE ATTEMPTS
-- ============================================
CREATE TABLE IF NOT EXISTS boss_stage_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID NOT NULL REFERENCES boss_battles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    stage_number INTEGER NOT NULL,
    user_solution JSONB, -- Code, text, or structured answer
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'in_review')),
    ai_diagnosis TEXT, -- Specific error analysis
    artifacts_highlighted UUID[] DEFAULT '{}', -- Which artifact sections to highlight
    validation_results JSONB, -- Detailed test results
    attempt_number INTEGER DEFAULT 1,
    time_spent_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(battle_id, stage_number, attempt_number)
);

-- Indexes for stage attempt lookups
CREATE INDEX idx_stage_attempts_battle_id ON boss_stage_attempts(battle_id);
CREATE INDEX idx_stage_attempts_user_id ON boss_stage_attempts(user_id);
CREATE INDEX idx_stage_attempts_status ON boss_stage_attempts(status);

-- ============================================
-- 8. ARTIFACT ACCESS LOG (For Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS artifact_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL REFERENCES knowledge_artifacts(id) ON DELETE CASCADE,
    access_context TEXT, -- e.g., "during_question", "boss_battle", "review"
    question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    search_query TEXT, -- If accessed via search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_artifact_logs_user_id ON artifact_access_logs(user_id);
CREATE INDEX idx_artifact_logs_artifact_id ON artifact_access_logs(artifact_id);
CREATE INDEX idx_artifact_logs_created ON artifact_access_logs(created_at DESC);

-- ============================================
-- 9. UPDATE TRIGGERS
-- ============================================

-- Update timestamps on projects
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project ON projects;
CREATE TRIGGER trigger_update_project
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_project_timestamp();

-- Update timestamps on chapters
CREATE OR REPLACE FUNCTION update_chapter_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chapter ON chapters;
CREATE TRIGGER trigger_update_chapter
    BEFORE UPDATE ON chapters
    FOR EACH ROW
    EXECUTE FUNCTION update_chapter_timestamp();

-- Update timestamps on artifacts
CREATE OR REPLACE FUNCTION update_artifact_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artifact ON knowledge_artifacts;
CREATE TRIGGER trigger_update_artifact
    BEFORE UPDATE ON knowledge_artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_artifact_timestamp();

-- ============================================
-- 10. PROJECT PROGRESS CALCULATION
-- ============================================
CREATE OR REPLACE FUNCTION calculate_project_progress()
RETURNS TRIGGER AS $$
DECLARE
    total_chapters INTEGER;
    completed_chapters INTEGER;
    new_confidence INTEGER;
BEGIN
    -- Get chapter counts
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
    INTO total_chapters, completed_chapters
    FROM chapters
    WHERE project_id = NEW.project_id;
    
    -- Calculate confidence based on attempt accuracy
    SELECT COALESCE(
        ROUND(
            (COUNT(*) FILTER (WHERE is_correct = TRUE) * 100.0 / NULLIF(COUNT(*), 0))
        ), 0
    )
    INTO new_confidence
    FROM question_attempts
    WHERE project_id = NEW.project_id;
    
    -- Update project
    UPDATE projects
    SET 
        total_chapters = total_chapters,
        completed_chapters = completed_chapters,
        confidence_score = new_confidence,
        updated_at = NOW()
    WHERE id = NEW.project_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on question attempts to update project progress
DROP TRIGGER IF EXISTS trigger_update_project_progress ON question_attempts;
CREATE TRIGGER trigger_update_project_progress
    AFTER INSERT ON question_attempts
    FOR EACH ROW
    EXECUTE FUNCTION calculate_project_progress();

-- ============================================
-- 11. CHAPTER COMPLETION CHECK
-- ============================================
CREATE OR REPLACE FUNCTION check_chapter_completion()
RETURNS TRIGGER AS $$
DECLARE
    total_questions INTEGER;
    correct_attempts INTEGER;
BEGIN
    -- Check if all questions in chapter have at least one correct attempt
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE q.id IN (
            SELECT question_id 
            FROM question_attempts 
            WHERE is_correct = TRUE
        ))
    INTO total_questions, correct_attempts
    FROM questions q
    WHERE q.chapter_id = NEW.chapter_id;
    
    -- If all questions answered correctly, mark chapter complete
    IF total_questions > 0 AND correct_attempts >= total_questions THEN
        UPDATE chapters
        SET 
            status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = NEW.chapter_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_chapter_completion ON question_attempts;
CREATE TRIGGER trigger_check_chapter_completion
    AFTER INSERT ON question_attempts
    FOR EACH ROW
    WHEN (NEW.is_correct = TRUE)
    EXECUTE FUNCTION check_chapter_completion();

-- ============================================
-- 12. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_stage_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_access_logs ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only see their own projects
DROP POLICY IF EXISTS projects_user_isolation ON projects;
CREATE POLICY projects_user_isolation ON projects
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- Chapters: Users can only see chapters in their projects
DROP POLICY IF EXISTS chapters_user_isolation ON chapters;
CREATE POLICY chapters_user_isolation ON chapters
    FOR ALL
    USING (
        project_id IN (
            SELECT id FROM projects WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Knowledge Artifacts: Users can only see their own artifacts
DROP POLICY IF EXISTS artifacts_user_isolation ON knowledge_artifacts;
CREATE POLICY artifacts_user_isolation ON knowledge_artifacts
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- Questions: Users can see questions in their chapters
DROP POLICY IF EXISTS questions_user_isolation ON questions;
CREATE POLICY questions_user_isolation ON questions
    FOR ALL
    USING (
        chapter_id IN (
            SELECT c.id FROM chapters c
            JOIN projects p ON c.project_id = p.id
            WHERE p.user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Question Attempts: Users can only see their own attempts
DROP POLICY IF EXISTS attempts_user_isolation ON question_attempts;
CREATE POLICY attempts_user_isolation ON question_attempts
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- Boss Battles: Users can only see their own battles
DROP POLICY IF EXISTS boss_battles_user_isolation ON boss_battles;
CREATE POLICY boss_battles_user_isolation ON boss_battles
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- Boss Stage Attempts: Users can only see their own attempts
DROP POLICY IF EXISTS stage_attempts_user_isolation ON boss_stage_attempts;
CREATE POLICY stage_attempts_user_isolation ON boss_stage_attempts
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- Artifact Access Logs: Users can only see their own logs
DROP POLICY IF EXISTS artifact_logs_user_isolation ON artifact_access_logs;
CREATE POLICY artifact_logs_user_isolation ON artifact_access_logs
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
