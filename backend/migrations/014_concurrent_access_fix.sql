-- ============================================
-- Migration: MISSION 62 - Concurrent Access Fix
-- Adds constraints and indexes for race condition prevention
-- ============================================

-- ============================================
-- 1. UNIQUE CONSTRAINT: Only one active session per student
-- This prevents duplicate active sessions at the database level
-- ============================================

-- First, handle any existing duplicate active sessions
-- Keep the most recent one, end the others
WITH duplicate_sessions AS (
  SELECT id, student_id, started_at,
         ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY started_at DESC) as rn
  FROM study_sessions
  WHERE is_active = true
)
UPDATE study_sessions ss
SET is_active = false,
    status = 'auto_ended',
    ended_at = NOW(),
    notes = 'Auto-ended: Duplicate session cleanup during migration'
FROM duplicate_sessions ds
WHERE ss.id = ds.id AND ds.rn > 1;

-- Now add partial unique index (only for active sessions)
-- Using partial index is more efficient than full unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_session 
ON study_sessions (student_id) 
WHERE is_active = true;

COMMENT ON INDEX idx_unique_active_session IS 
'Prevents multiple active sessions per student at database level';

-- ============================================
-- 2. INDEXES FOR CONCURRENT ACCESS PATTERNS
-- ============================================

-- Index for checking active sessions (most common query)
CREATE INDEX IF NOT EXISTS idx_study_sessions_active_student 
ON study_sessions (student_id, is_active, started_at) 
WHERE is_active = true;

-- Index for session history queries
CREATE INDEX IF NOT EXISTS idx_study_sessions_history 
ON study_sessions (student_id, status, started_at DESC);

-- Index for concurrent achievement checking
CREATE INDEX IF NOT EXISTS idx_student_achievements_lookup 
ON student_achievements (student_id, achievement_id, unlocked_at);

-- ============================================
-- 3. OPTIMIZE STUDENTS TABLE FOR CONCURRENT UPDATES
-- ============================================

-- Index for student stats lookup (used in session end)
CREATE INDEX IF NOT EXISTS idx_students_stats 
ON students (id) 
INCLUDE (xp, level, total_study_time, total_sessions, current_streak, longest_streak);

-- ============================================
-- 4. CONNECTION POOL OPTIMIZATION SETTINGS
-- These are session-level settings, applied per connection
-- ============================================

-- Function to set connection pool optimized settings
CREATE OR REPLACE FUNCTION set_connection_pool_settings()
RETURNS void AS $$
BEGIN
  -- Statement timeout (30 seconds)
  SET statement_timeout = '30s';
  
  -- Lock timeout (10 seconds)
  SET lock_timeout = '10s';
  
  -- Idle in transaction timeout (60 seconds)
  SET idle_in_transaction_session_timeout = '60s';
  
  -- Enable deadlock detection priority
  SET deadlock_timeout = '5s';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_connection_pool_settings() IS 
'Apply connection pool optimized settings for Render/Supabase deployment';

-- ============================================
-- 5. ROW-LEVEL LOCKING HELPER FUNCTION
-- For safe concurrent session operations
-- ============================================

-- Function to safely end a session with row locking
CREATE OR REPLACE FUNCTION end_study_session(
  p_session_id UUID,
  p_student_id UUID,
  p_duration_minutes INTEGER,
  p_xp_earned INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  session_id UUID
) AS $$
DECLARE
  v_session_exists BOOLEAN;
  v_updated_rows INTEGER;
BEGIN
  -- Check if session exists and belongs to student (with lock)
  SELECT EXISTS(
    SELECT 1 FROM study_sessions 
    WHERE id = p_session_id 
    AND student_id = p_student_id 
    AND is_active = true
    FOR UPDATE NOWAIT
  ) INTO v_session_exists;
  
  IF NOT v_session_exists THEN
    RETURN QUERY SELECT false, 'Session not found or already ended', p_session_id;
    RETURN;
  END IF;
  
  -- Update session
  UPDATE study_sessions 
  SET ended_at = NOW(),
      duration = p_duration_minutes,
      xp_earned = p_xp_earned,
      is_active = false,
      status = 'completed',
      notes = COALESCE(p_notes, notes),
      updated_at = NOW()
  WHERE id = p_session_id;
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  
  IF v_updated_rows > 0 THEN
    RETURN QUERY SELECT true, 'Session ended successfully', p_session_id;
  ELSE
    RETURN QUERY SELECT false, 'Failed to update session', p_session_id;
  END IF;
  
EXCEPTION
  WHEN lock_not_available THEN
    RETURN QUERY SELECT false, 'Session is being processed by another request', p_session_id;
  WHEN deadlock_detected THEN
    RETURN QUERY SELECT false, 'Deadlock detected, please retry', p_session_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION end_study_session IS 
'Atomically end a study session with row-level locking';

-- ============================================
-- 6. ACHIEVEMENT UNLOCK WITH DEDUPLICATION
-- ============================================

-- Function to safely unlock an achievement
CREATE OR REPLACE FUNCTION unlock_achievement_safe(
  p_student_id UUID,
  p_achievement_id UUID,
  p_progress INTEGER DEFAULT 0
)
RETURNS TABLE (
  success BOOLEAN,
  was_already_unlocked BOOLEAN,
  achievement_name TEXT
) AS $$
DECLARE
  v_achievement RECORD;
  v_already_unlocked BOOLEAN;
BEGIN
  -- Get achievement details
  SELECT id, name, points_reward 
  INTO v_achievement
  FROM achievements 
  WHERE id = p_achievement_id AND is_active = true;
  
  IF v_achievement IS NULL THEN
    RETURN QUERY SELECT false, false, 'Achievement not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check if already unlocked (with lock)
  SELECT EXISTS(
    SELECT 1 FROM student_achievements
    WHERE student_id = p_student_id 
    AND achievement_id = p_achievement_id
    AND unlocked_at IS NOT NULL
    FOR UPDATE
  ) INTO v_already_unlocked;
  
  IF v_already_unlocked THEN
    RETURN QUERY SELECT true, true, v_achievement.name;
    RETURN;
  END IF;
  
  -- Insert or update with unlock
  INSERT INTO student_achievements (student_id, achievement_id, progress, unlocked_at)
  VALUES (p_student_id, p_achievement_id, p_progress, CURRENT_TIMESTAMP)
  ON CONFLICT (student_id, achievement_id)
  DO UPDATE SET 
    unlocked_at = CURRENT_TIMESTAMP,
    progress = p_progress
  WHERE student_achievements.unlocked_at IS NULL;
  
  -- Award points
  UPDATE students
  SET total_points = COALESCE(total_points, 0) + v_achievement.points_reward
  WHERE id = p_student_id;
  
  RETURN QUERY SELECT true, false, v_achievement.name;
  
EXCEPTION
  WHEN deadlock_detected THEN
    RETURN QUERY SELECT false, false, 'Deadlock detected, please retry'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION unlock_achievement_safe IS 
'Safely unlock achievement with duplicate prevention';

-- ============================================
-- 7. CLEANUP OLD SESSIONS (Maintenance)
-- Function to cleanup abandoned sessions older than 7 days
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_abandoned_sessions(
  p_days_old INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE study_sessions
  SET is_active = false,
      status = 'abandoned',
      ended_at = NOW()
  WHERE is_active = true
    AND started_at < NOW() - (p_days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_abandoned_sessions IS 
'Cleanup sessions abandoned for more than N days';

-- ============================================
-- 8. MONITORING VIEW
-- ============================================

CREATE OR REPLACE VIEW session_monitoring AS
SELECT 
  s.id as student_id,
  s.username,
  COUNT(ss.id) FILTER (WHERE ss.is_active = true) as active_sessions,
  COUNT(ss.id) FILTER (WHERE ss.status = 'completed' AND ss.started_at > NOW() - INTERVAL '24 hours') as sessions_24h,
  MAX(ss.started_at) FILTER (WHERE ss.is_active = true) as oldest_active_session
FROM students s
LEFT JOIN study_sessions ss ON s.id = ss.student_id
GROUP BY s.id, s.username;

COMMENT ON VIEW session_monitoring IS 
'Monitoring view for concurrent session detection';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'MISSION 62: Concurrent access fix applied successfully! 🚀' as message;
SELECT 'Applied:' as detail;
SELECT '- Partial unique index on active sessions' as detail;
SELECT '- Optimized indexes for concurrent patterns' as detail;
SELECT '- Row-level locking helper functions' as detail;
SELECT '- Achievement deduplication functions' as detail;
