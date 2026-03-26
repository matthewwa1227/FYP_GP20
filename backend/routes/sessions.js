// ============================================
// StudyQuest - Study Session Routes
// FYP GP20 - Session Management & Tracking
// MISSION 62: Fixed for concurrent access & race conditions
// ============================================

const express = require('express');
const router = express.Router();
const { pool, withTransaction } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { sessionActionLimiter } = require('../middleware/concurrencyGuard');
const {
    calculateXP,
    calculateLevel,
    getLevelProgress,
    calculateStreak,
    generateSessionSummary
} = require('../utils/gamification');

// ============================================
// POST /api/sessions/start
// Start a new study session
// MISSION 62: Auto-ends previous session if exists (multi-device support)
// ============================================
router.post('/start', authenticateToken, sessionActionLimiter, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { subject, topic, deviceId } = req.body;
        const studentId = req.student.id;
        
        // Validate input
        if (!subject || subject.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Subject is required' 
            });
        }
        
        // Start transaction with row-level locking
        await client.query('BEGIN');
        await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        
        // MISSION 62: Lock the student's active session row (if any) to prevent race conditions
        const activeCheck = await client.query(
            `SELECT id, subject, started_at, device_id 
             FROM study_sessions 
             WHERE student_id = $1 AND is_active = true
             FOR UPDATE`, // Row-level lock!
            [studentId]
        );
        
        let previousSession = null;
        
        if (activeCheck.rows.length > 0) {
            const existingSession = activeCheck.rows[0];
            
            // MISSION 62: Auto-end previous session from another device
            const startedAt = new Date(existingSession.started_at);
            const now = new Date();
            const durationSeconds = Math.floor((now - startedAt) / 1000);
            const durationMinutes = Math.floor(durationSeconds / 60);
            
            // Calculate XP for abandoned session (50% penalty for auto-end)
            const xpEarned = Math.max(1, Math.floor(calculateXP(durationSeconds) * 0.5));
            
            await client.query(
                `UPDATE study_sessions 
                 SET ended_at = NOW(), 
                     duration = $1,
                     xp_earned = $2,
                     is_active = false,
                     status = 'auto_ended',
                     notes = 'Auto-ended: Started new session on another device',
                     updated_at = NOW()
                 WHERE id = $3`,
                [durationMinutes, xpEarned, existingSession.id]
            );
            
            previousSession = {
                id: existingSession.id,
                subject: existingSession.subject,
                durationSeconds,
                xpEarned
            };
            
            console.log(`🔄 Auto-ended previous session ${existingSession.id} for student ${studentId}`);
        }
        
        // Create new session
        const result = await client.query(
            `INSERT INTO study_sessions 
             (student_id, subject, topic, started_at, is_active, status, device_id) 
             VALUES ($1, $2, $3, NOW(), true, 'active', $4) 
             RETURNING *`,
            [studentId, subject.trim(), topic ? topic.trim() : null, deviceId || null]
        );
        
        await client.query('COMMIT');
        
        const response = {
            success: true,
            message: previousSession 
                ? `Previous session auto-ended. New study session started! 📚`
                : 'Study session started successfully! 📚',
            session: result.rows[0]
        };
        
        if (previousSession) {
            response.previousSession = previousSession;
        }
        
        res.status(201).json(response);
        
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        
        // MISSION 62: Handle serialization failure (concurrent start attempt)
        if (error.code === '40001' || error.message?.includes('serialization')) {
            console.warn('⚠️ Concurrent session start detected for student:', req.student.id);
            return res.status(409).json({
                success: false,
                message: 'Session start conflict. Please try again in a moment.',
                code: 'CONCURRENT_START'
            });
        }
        
        console.error('Error starting session:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to start session',
            error: error.message 
        });
    } finally {
        client.release();
    }
});

// ============================================
// POST /api/sessions/:sessionId/end
// End an active study session
// MISSION 62: Atomic transaction with SELECT FOR UPDATE
// ============================================
router.post('/:sessionId/end', authenticateToken, sessionActionLimiter, async (req, res) => {
    const { sessionId } = req.params;
    const { notes, duration } = req.body;
    const studentId = req.student.id;
    
    try {
        // MISSION 62: Use withTransaction helper for automatic retries
        const result = await withTransaction(async (client) => {
            // Lock the session row
            const sessionResult = await client.query(
                `SELECT * FROM study_sessions 
                 WHERE id = $1 AND student_id = $2 AND is_active = true
                 FOR UPDATE NOWAIT`, // Fail fast if locked
                [sessionId, studentId]
            );
            
            if (sessionResult.rows.length === 0) {
                throw new Error('SESSION_NOT_FOUND');
            }
            
            const session = sessionResult.rows[0];
            
            // Calculate duration in SECONDS
            let durationSeconds;
            if (duration !== undefined && duration !== null) {
                durationSeconds = Math.floor(duration);
            } else {
                const startedAt = new Date(session.started_at);
                durationSeconds = Math.floor((Date.now() - startedAt) / 1000);
            }
            
            // Check minimum duration (10 seconds)
            if (durationSeconds < 10) {
                throw new Error('SESSION_TOO_SHORT');
            }
            
            const xpGained = calculateXP(durationSeconds);
            const durationMinutes = Math.floor(durationSeconds / 60);
            
            // Lock student row for update (prevent race conditions on XP/stats)
            const oldStatsResult = await client.query(
                'SELECT * FROM students WHERE id = $1 FOR UPDATE',
                [studentId]
            );
            const oldStats = oldStatsResult.rows[0];
            
            // Calculate new stats
            const streakData = calculateStreak(oldStats.updated_at, oldStats.current_streak || 0);
            const newXP = oldStats.xp + xpGained;
            const newLevel = calculateLevel(newXP);
            const newTotalStudyTime = oldStats.total_study_time + durationMinutes;
            const newTotalSessions = oldStats.total_sessions + 1;
            const newLongestStreak = Math.max(oldStats.longest_streak || 0, streakData.streak);
            
            // Update session
            await client.query(
                `UPDATE study_sessions 
                 SET ended_at = NOW(), 
                     duration = $1,  
                     xp_earned = $2,  
                     is_active = false, 
                     status = 'completed',
                     notes = $3,
                     updated_at = NOW()
                 WHERE id = $4`,
                [durationMinutes, xpGained, notes || null, sessionId]
            );
            
            // Update student stats atomically
            const updateResult = await client.query(
                `UPDATE students 
                 SET xp = $1, 
                     level = $2, 
                     total_study_time = $3, 
                     total_sessions = $4,
                     current_streak = $5,
                     longest_streak = $6,
                     updated_at = NOW()
                 WHERE id = $7
                 RETURNING *`,
                [newXP, newLevel, newTotalStudyTime, newTotalSessions, 
                 streakData.streak, newLongestStreak, studentId]
            );
            
            return {
                session: { ...session, ended_at: new Date(), duration: durationMinutes, xp_earned: xpGained },
                oldStats,
                newStats: updateResult.rows[0],
                durationSeconds,
                xpGained
            };
        }, { retries: 3, isolationLevel: 'SERIALIZABLE' });
        
        // Generate response
        const { session, oldStats, newStats, durationSeconds, xpGained } = result;
        
        const motivation = {
            title: durationSeconds >= 3600 ? '🌟 Amazing Focus!' :
                   durationSeconds >= 1800 ? '💪 Great Session!' :
                   durationSeconds >= 900 ? '✨ Good Work!' :
                   durationSeconds >= 60 ? '📚 Nice Start!' :
                   '⚡ Quick Study!',
            message: `You studied for ${formatDuration(durationSeconds)} and earned ${xpGained} XP!`
        };
        
        const summary = generateSessionSummary(session, oldStats, newStats);
        const levelProgress = getLevelProgress(newStats.xp, newStats.level);
        
        res.json({
            success: true,
            message: motivation.title,
            session,
            summary: { ...summary, levelProgress, motivation },
            stats: {
                level: newStats.level,
                xp: newStats.xp,
                totalStudyTime: newStats.total_study_time,
                totalSessions: newStats.total_sessions,
                currentStreak: newStats.current_streak,
                longestStreak: newStats.longest_streak
            }
        });
        
    } catch (error) {
        // Handle specific errors
        if (error.message === 'SESSION_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                message: 'Active session not found or already ended'
            });
        }
        
        if (error.message === 'SESSION_TOO_SHORT') {
            return res.status(400).json({
                success: false,
                message: 'Session too short. Please study for at least 10 seconds.'
            });
        }
        
        if (error.code === '55P03' || error.message?.includes('lock not available')) {
            return res.status(423).json({
                success: false,
                message: 'Session is being processed by another request. Please try again.',
                code: 'LOCKED'
            });
        }
        
        console.error('Error ending session:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to end session',
            error: error.message 
        });
    }
});

// ============================================
// Helper function to format duration
// ============================================
function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds} seconds`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins} min ${secs} sec` : `${mins} minutes`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hours`;
    }
}

// ============================================
// GET /api/sessions/active
// Get current active session if any
// ============================================
router.get('/active', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM study_sessions 
             WHERE student_id = $1 AND is_active = true
             ORDER BY started_at DESC
             LIMIT 1`,
            [req.student.id]
        );
        
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                hasActiveSession: false,
                session: null
            });
        }
        
        const session = result.rows[0];
        const startedAt = new Date(session.started_at);
        const now = new Date();
        const currentDurationMinutes = Math.floor((now - startedAt) / (1000 * 60));
        
        res.json({
            success: true,
            hasActiveSession: true,
            session: {
                ...session,
                currentDuration: currentDurationMinutes
            }
        });
        
    } catch (error) {
        console.error('Error getting active session:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get active session',
            error: error.message 
        });
    }
});

// ============================================
// GET /api/sessions/history
// Get study session history with pagination
// ============================================
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, subject } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT * FROM study_sessions 
            WHERE student_id = $1 AND status = 'completed'
        `;
        const params = [req.student.id];
        
        if (subject) {
            query += ` AND subject = $${params.length + 1}`;
            params.push(subject);
        }
        
        query += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        
        let countQuery = 'SELECT COUNT(*) FROM study_sessions WHERE student_id = $1 AND status = \'completed\'';
        const countParams = [req.student.id];
        if (subject) {
            countQuery += ' AND subject = $2';
            countParams.push(subject);
        }
        const countResult = await pool.query(countQuery, countParams);
        const totalSessions = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            sessions: result.rows,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalSessions / limit),
                totalSessions,
                sessionsPerPage: parseInt(limit)
            }
        });
        
    } catch (error) {
        console.error('Error getting session history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get session history',
            error: error.message 
        });
    }
});

// ============================================
// GET /api/sessions/stats
// Get aggregated session statistics
// ============================================
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        
        const statsResult = await pool.query(
            'SELECT * FROM students WHERE id = $1',
            [studentId]
        );
        
        if (statsResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }
        
        const student = statsResult.rows[0];
        
        const subjectResult = await pool.query(
            `SELECT 
                subject,
                COUNT(*) as session_count,
                SUM(duration) as total_minutes,
                AVG(duration) as avg_duration
            FROM study_sessions
            WHERE student_id = $1 AND status = 'completed'
            GROUP BY subject
            ORDER BY total_minutes DESC`,
            [studentId]
        );
        
        const activityResult = await pool.query(
            `SELECT 
                DATE(started_at) as study_date,
                COUNT(*) as sessions,
                SUM(duration) as minutes
            FROM study_sessions
            WHERE student_id = $1 
                AND status = 'completed'
                AND started_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(started_at)
            ORDER BY study_date DESC`,
            [studentId]
        );
        
        const levelProgress = getLevelProgress(student.xp, student.level);
        
        res.json({
            success: true,
            stats: {
                level: student.level,
                xp: student.xp,
                levelProgress,
                totalStudyTime: student.total_study_time,
                totalSessions: student.total_sessions,
                currentStreak: student.current_streak,
                longestStreak: student.longest_streak,
                averageSessionDuration: student.total_sessions > 0 
                    ? Math.floor(student.total_study_time / student.total_sessions) 
                    : 0
            },
            subjectBreakdown: subjectResult.rows,
            recentActivity: activityResult.rows
        });
        
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get statistics',
            error: error.message 
        });
    }
});

// ============================================
// POST /api/sessions/abandon/:sessionId
// Abandon an active session
// ============================================
router.post('/abandon/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const studentId = req.student.id;
        
        await pool.query(
            `UPDATE study_sessions 
             SET is_active = false, 
                 status = 'abandoned',
                 ended_at = NOW()
             WHERE id = $1 AND student_id = $2 AND is_active = true`,
            [sessionId, studentId]
        );
        
        res.json({
            success: true,
            message: 'Session abandoned'
        });
        
    } catch (error) {
        console.error('Error abandoning session:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to abandon session'
        });
    }
});

module.exports = router;
