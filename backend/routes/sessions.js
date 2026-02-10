// ============================================
// StudyQuest - Study Session Routes
// FYP GP20 - Session Management & Tracking
// ============================================

const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
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
// ============================================
router.post('/start', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { subject, topic } = req.body;
        const studentId = req.student.id;
        
        // Validate input
        if (!subject || subject.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Subject is required' 
            });
        }
        
        // Check if user already has an active session
        const activeCheck = await client.query(
            'SELECT id FROM study_sessions WHERE student_id = $1 AND is_active = true',
            [studentId]
        );
        
        if (activeCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active session. Please end it first.'
            });
        }
        
        // Create new session
        const result = await client.query(
            `INSERT INTO study_sessions 
            (student_id, subject, topic, started_at, is_active, status) 
            VALUES ($1, $2, $3, NOW(), true, 'active') 
            RETURNING *`,
            [studentId, subject.trim(), topic ? topic.trim() : null]
        );
        
        res.status(201).json({
            success: true,
            message: 'Study session started successfully! 📚',
            session: result.rows[0]
        });
        
    } catch (error) {
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
// ✅ UPDATED: Now accepts duration in SECONDS
// ============================================
router.post('/:sessionId/end', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { sessionId } = req.params;
        const { notes, duration } = req.body; // duration is now in SECONDS
        const studentId = req.student.id;
        
        // Get the active session
        const sessionResult = await client.query(
            `SELECT * FROM study_sessions 
            WHERE id = $1 AND student_id = $2 AND is_active = true`,
            [sessionId, studentId]
        );
        
        if (sessionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Active session not found'
            });
        }
        
        const session = sessionResult.rows[0];
        
        // ✅ UPDATED: Calculate duration in SECONDS
        let durationSeconds;
        if (duration !== undefined && duration !== null) {
            durationSeconds = Math.floor(duration);
        } else {
            const startedAt = new Date(session.started_at);
            const endedAt = new Date();
            durationSeconds = Math.floor((endedAt - startedAt) / 1000);
        }
        
        // ✅ UPDATED: Check minimum duration (10 seconds instead of 1 minute)
        if (durationSeconds < 10) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Session too short. Please study for at least 10 seconds.'
            });
        }
        
        // ✅ UPDATED: Calculate XP (1 XP per 10 seconds)
        const xpGained = calculateXP(durationSeconds);
        
        // Convert seconds to minutes for storage (keep backward compatibility)
        const durationMinutes = Math.floor(durationSeconds / 60);
        
        console.log(`📊 Session rewards: ${durationSeconds} sec (${durationMinutes} min) = ${xpGained} XP`);
        
        // Get current student stats
        const oldStatsResult = await client.query(
            'SELECT * FROM students WHERE id = $1',
            [studentId]
        );
        const oldStats = oldStatsResult.rows[0];
        
        // Calculate new streak
        const streakData = calculateStreak(
            oldStats.updated_at, 
            oldStats.current_streak || 0
        );
        
        // Update session record (store minutes for backward compatibility)
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
        
        // Update student stats
        const newXP = oldStats.xp + xpGained;
        const newLevel = calculateLevel(newXP);
        const newTotalStudyTime = oldStats.total_study_time + durationMinutes;
        const newTotalSessions = oldStats.total_sessions + 1;
        const newLongestStreak = Math.max(
            oldStats.longest_streak || 0, 
            streakData.streak
        );
        
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
            [
                newXP, 
                newLevel, 
                newTotalStudyTime, 
                newTotalSessions,
                streakData.streak,
                newLongestStreak,
                studentId
            ]
        );
        
        const newStats = updateResult.rows[0];
        
        // Get updated session
        const updatedSession = await client.query(
            'SELECT * FROM study_sessions WHERE id = $1',
            [sessionId]
        );
        
        await client.query('COMMIT');
        
        // ✅ UPDATED: Generate motivational message based on duration (in seconds)
        const motivation = {
            title: durationSeconds >= 3600 ? '🌟 Amazing Focus!' :
                   durationSeconds >= 1800 ? '💪 Great Session!' :
                   durationSeconds >= 900 ? '✨ Good Work!' :
                   durationSeconds >= 60 ? '📚 Nice Start!' :
                   '⚡ Quick Study!',
            message: `You studied for ${formatDuration(durationSeconds)} and earned ${xpGained} XP!`
        };
        
        // Generate session summary
        const summary = generateSessionSummary(
            updatedSession.rows[0], 
            oldStats, 
            newStats
        );
        
        // Get level progress
        const levelProgress = getLevelProgress(newStats.xp, newStats.level);
        
        res.json({
            success: true,
            message: motivation.title,
            session: updatedSession.rows[0],
            summary: {
                ...summary,
                levelProgress,
                motivation
            },
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
        await client.query('ROLLBACK');
        console.error('Error ending session:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to end session',
            error: error.message 
        });
    } finally {
        client.release();
    }
});

// ✅ NEW: Helper function to format duration
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
        
        // Calculate current duration
        const session = result.rows[0];
        const startedAt = new Date(session.started_at);
        const now = new Date();
        const currentDuration = Math.floor((now - startedAt) / (1000 * 60)); // Still in minutes for display
        
        res.json({
            success: true,
            hasActiveSession: true,
            session: {
                ...session,
                currentDuration
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
        
        // Filter by subject if provided
        if (subject) {
            query += ` AND subject = $${params.length + 1}`;
            params.push(subject);
        }
        
        query += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        
        // Get total count
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
        
        // Get overall stats
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
        
        // Get subject breakdown
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
        
        // Get recent activity (last 7 days)
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
        
        // Calculate level progress
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
// Abandon an active session (for page refresh recovery)
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