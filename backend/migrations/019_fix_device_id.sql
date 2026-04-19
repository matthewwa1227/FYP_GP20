-- ============================================
-- Migration 019: Fix missing device_id column and uploads directory issues
-- ============================================

-- Add device_id column to study_sessions (referenced by sessions.js MISSION 62)
ALTER TABLE study_sessions
ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);

-- Index for device-based session lookups
CREATE INDEX IF NOT EXISTS idx_study_sessions_device_id ON study_sessions(device_id);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Migration 019: device_id column added successfully! 📱' as message;
