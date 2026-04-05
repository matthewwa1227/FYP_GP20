-- ============================================
-- STUDYQUEST REBUILD - Phase 1: Data Layer
-- Project-based learning system with Knowledge Artifacts
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Projects: Main learning units (replaces StoryQuest chapters)
CREATE TABLE user_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- e.g., "Python Fitness Analyzer"
  description TEXT,
  deliverable TEXT NOT NULL, -- "Working dashboard script"
  subject TEXT, -- "Programming", "Math", etc.
  status TEXT DEFAULT 'active', -- active, completed, archived
  current_chapter_id UUID,
  skill_tree JSONB DEFAULT '[]', -- Branching skill tree structure
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Chapters: Individual learning modules within a project
CREATE TABLE project_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES user_projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  -- Context-first learning design
  context TEXT, -- Real-world scenario (e.g., "Loading Apple Health data")
  key_points TEXT[], -- Key concepts (3-5 bullets)
  full_lesson TEXT, -- Full lesson content (markdown)
  why_it_matters TEXT, -- Connect to deliverable
  -- Practice content
  questions JSONB DEFAULT '[]', -- Array of question objects
  referenced_artifact_ids UUID[] DEFAULT '{}', -- Artifacts shown during practice
  -- Progress
  status TEXT DEFAULT 'active', -- active, completed, locked
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge Artifacts: Student's permanent notes/cheat sheets
CREATE TABLE knowledge_artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES user_projects(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES project_chapters(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  -- Content
  title TEXT NOT NULL, -- "CSV Reading Cheat Sheet"
  content_markdown TEXT NOT NULL,
  summary TEXT, -- One-line summary
  tags TEXT[],
  -- Meta
  times_accessed INTEGER DEFAULT 0, -- Analytics
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chapter attempts: Answer tracking with AI diagnosis
CREATE TABLE chapter_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID REFERENCES project_chapters(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  -- Question info
  question_type TEXT CHECK (question_type IN ('multiple_choice', 'code_execution', 'fill_blank', 'error_analysis', 'concept_synthesis')),
  question_index INTEGER DEFAULT 0,
  -- Answer
  user_answer TEXT,
  is_correct BOOLEAN,
  -- AI Diagnosis (scaffolded retry)
  ai_diagnosis TEXT, -- What went wrong
  ai_mini_lesson TEXT, -- Targeted explanation
  -- Open-book reference
  references_artifact_id UUID REFERENCES knowledge_artifacts(id),
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Artifact references: Links artifacts to specific questions
CREATE TABLE artifact_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artifact_id UUID REFERENCES knowledge_artifacts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES chapter_attempts(id) ON DELETE CASCADE,
  relevance_score FLOAT DEFAULT 1.0, -- 0-1, for sorting
  highlighted_section TEXT, -- Section name to highlight
  created_at TIMESTAMP DEFAULT NOW()
);

-- Boss Battles: Multi-stage synthesis challenges
CREATE TABLE boss_battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES user_projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  -- Battle info
  title TEXT NOT NULL, -- "The Dashboard Challenge"
  description TEXT,
  scenario TEXT, -- Real-world context
  deliverable TEXT, -- What must be produced
  -- Stages (scaffolded)
  stages JSONB DEFAULT '[]', -- Array of stage objects
  current_stage INTEGER DEFAULT 0,
  failed_stage INTEGER, -- Which stage needs retry (null if none)
  -- Progress
  status TEXT DEFAULT 'active', -- active, completed, abandoned
  ai_diagnosis TEXT, -- Stored diagnosis for failed stage
  -- Reward
  badge_name TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Project skill tree: Branching learning paths
CREATE TABLE project_skill_tree (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES user_projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  prerequisites TEXT[] DEFAULT '{}', -- Skill names that unlock this
  unlocks TEXT[] DEFAULT '{}', -- Skills this unlocks
  is_unlocked BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  estimated_minutes INTEGER DEFAULT 20,
  chapter_id UUID REFERENCES project_chapters(id), -- Link to chapter
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX idx_user_projects_status ON user_projects(status);
CREATE INDEX idx_project_chapters_project_id ON project_chapters(project_id);
CREATE INDEX idx_project_chapters_user_id ON project_chapters(user_id);
CREATE INDEX idx_chapter_attempts_chapter_id ON chapter_attempts(chapter_id);
CREATE INDEX idx_chapter_attempts_user_id ON chapter_attempts(user_id);
CREATE INDEX idx_knowledge_artifacts_project_id ON knowledge_artifacts(project_id);
CREATE INDEX idx_knowledge_artifacts_user_id ON knowledge_artifacts(user_id);
CREATE INDEX idx_boss_battles_project_id ON boss_battles(project_id);
CREATE INDEX idx_boss_battles_user_id ON boss_battles(user_id);
CREATE INDEX idx_artifact_refs_artifact_id ON artifact_references(artifact_id);
CREATE INDEX idx_artifact_refs_question_id ON artifact_references(question_id);
CREATE INDEX idx_skill_tree_project_id ON project_skill_tree(project_id);

-- ============================================
-- RLS POLICIES (for Supabase)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_skill_tree ENABLE ROW LEVEL SECURITY;

-- User projects policies
CREATE POLICY "Users can view own projects" ON user_projects
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own projects" ON user_projects
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own projects" ON user_projects
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own projects" ON user_projects
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Project chapters policies
CREATE POLICY "Users can view own chapters" ON project_chapters
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own chapters" ON project_chapters
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own chapters" ON project_chapters
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Chapter attempts policies
CREATE POLICY "Users can view own attempts" ON chapter_attempts
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own attempts" ON chapter_attempts
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Knowledge artifacts policies
CREATE POLICY "Users can view own artifacts" ON knowledge_artifacts
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own artifacts" ON knowledge_artifacts
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Boss battles policies
CREATE POLICY "Users can view own boss battles" ON boss_battles
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own boss battles" ON boss_battles
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own boss battles" ON boss_battles
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Skill tree policies
CREATE POLICY "Users can view own skill tree" ON project_skill_tree
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own skill tree" ON project_skill_tree
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update artifact updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_knowledge_artifacts_updated_at
  BEFORE UPDATE ON knowledge_artifacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-increment artifact access count
CREATE OR REPLACE FUNCTION increment_artifact_access()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE knowledge_artifacts 
  SET times_accessed = times_accessed + 1 
  WHERE id = NEW.artifact_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_access_on_reference
  AFTER INSERT ON artifact_references
  FOR EACH ROW EXECUTE FUNCTION increment_artifact_access();

-- ============================================
-- VIEWS
-- ============================================

-- User learning progress overview
CREATE OR REPLACE VIEW user_learning_progress AS
SELECT 
  u.id as user_id,
  u.username,
  COUNT(DISTINCT p.id) as total_projects,
  COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) as completed_projects,
  COUNT(DISTINCT c.id) as total_chapters,
  COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_chapters,
  COUNT(DISTINCT a.id) as total_artifacts,
  COUNT(DISTINCT CASE WHEN bb.status = 'completed' THEN bb.id END) as boss_battles_won
FROM students u
LEFT JOIN user_projects p ON u.id = p.user_id
LEFT JOIN project_chapters c ON p.id = c.project_id
LEFT JOIN knowledge_artifacts a ON p.id = a.project_id
LEFT JOIN boss_battles bb ON p.id = bb.project_id
GROUP BY u.id, u.username;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
