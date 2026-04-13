-- ============================================
-- NEWQUEST: Enhanced Boss Battle Schema
-- Adds metadata, hotfix tracking, and retake history
-- Compatible with 015_studyquest_rebuild.sql schema
-- ============================================

-- Add metadata and master artifact columns to existing boss_battles
ALTER TABLE boss_battles 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS master_artifact JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stage_solutions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS badge_tier TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS used_downshifts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retake_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_stage INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_diagnosis TEXT DEFAULT NULL;

-- Table for tracking boss battle attempts (for retake history)
CREATE TABLE IF NOT EXISTS boss_battle_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_battle_id UUID REFERENCES boss_battles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES students(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  badge_tier TEXT, -- mastery | proficiency | completion
  stage_results JSONB DEFAULT '[]',
  master_artifact JSONB,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for hotfix mode edits (stage-to-stage repairs)
CREATE TABLE IF NOT EXISTS boss_battle_hotfixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_battle_id UUID REFERENCES boss_battles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES students(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL,
  original_solution TEXT,
  fixed_solution TEXT,
  validation_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_boss_attempts_battle_id ON boss_battle_attempts(boss_battle_id);
CREATE INDEX IF NOT EXISTS idx_boss_attempts_user_id ON boss_battle_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_boss_hotfixes_battle_id ON boss_battle_hotfixes(boss_battle_id);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
