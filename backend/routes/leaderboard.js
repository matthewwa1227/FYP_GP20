const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET /api/leaderboard/global - Global Leaderboard
// ============================================
router.get('/global', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const period = req.query.period || 'all-time'; // all-time, weekly, monthly

    let query = `
      SELECT 
        s.id,
        s.username,
        s.level,
        s.xp,
        s.total_points,
        s.total_study_time,
        s.total_sessions,
        s.current_streak,
        ROW_NUMBER() OVER (ORDER BY s.total_points DESC, s.xp DESC) as rank
      FROM students s
    `;

    // Add time filters for weekly/monthly
    if (period === 'weekly') {
      query = `
        SELECT 
          s.id,
          s.username,
          s.level,
          s.xp,
          COALESCE(SUM(ss.duration_minutes), 0) as total_study_time,
          COUNT(ss.id) as total_sessions,
          s.current_streak,
          ROW_NUMBER() OVER (ORDER BY SUM(ss.duration_minutes) DESC) as rank
        FROM students s
        LEFT JOIN study_sessions ss ON s.id = ss.student_id 
          AND ss.start_time >= date_trunc('week', CURRENT_DATE)
          AND ss.status = 'completed'
        GROUP BY s.id, s.username, s.level, s.xp, s.current_streak
      `;
    } else if (period === 'monthly') {
      query = `
        SELECT 
          s.id,
          s.username,
          s.level,
          s.xp,
          COALESCE(SUM(ss.duration_minutes), 0) as total_study_time,
          COUNT(ss.id) as total_sessions,
          s.current_streak,
          ROW_NUMBER() OVER (ORDER BY SUM(ss.duration_minutes) DESC) as rank
        FROM students s
        LEFT JOIN study_sessions ss ON s.id = ss.student_id 
          AND ss.start_time >= date_trunc('month', CURRENT_DATE)
          AND ss.status = 'completed'
        GROUP BY s.id, s.username, s.level, s.xp, s.current_streak
      `;
    }

    query += ` ORDER BY rank LIMIT $1`;

    const result = await db.query(query, [limit]);

    res.json({
      success: true,
      period,
      count: result.rows.length,
      leaderboard: result.rows
    });

  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: error.message
    });
  }
});

// ============================================
// GET /api/leaderboard/my-rank - Get Current User's Rank
// ============================================
router.get('/my-rank', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const period = req.query.period || 'all-time';

    let query;
    
    if (period === 'all-time') {
      query = `
        WITH ranked_students AS (
          SELECT 
            id,
            username,
            level,
            xp,
            total_points,
            total_study_time,
            total_sessions,
            current_streak,
            ROW_NUMBER() OVER (ORDER BY total_points DESC, xp DESC) as rank
          FROM students
        )
        SELECT * FROM ranked_students WHERE id = $1
      `;
    } else if (period === 'weekly') {
      query = `
        WITH weekly_stats AS (
          SELECT 
            s.id,
            s.username,
            s.level,
            s.xp,
            COALESCE(SUM(ss.duration_minutes), 0) as total_study_time,
            COUNT(ss.id) as total_sessions,
            s.current_streak,
            ROW_NUMBER() OVER (ORDER BY SUM(ss.duration_minutes) DESC) as rank
          FROM students s
          LEFT JOIN study_sessions ss ON s.id = ss.student_id 
            AND ss.start_time >= date_trunc('week', CURRENT_DATE)
            AND ss.status = 'completed'
          GROUP BY s.id, s.username, s.level, s.xp, s.current_streak
        )
        SELECT * FROM weekly_stats WHERE id = $1
      `;
    } else if (period === 'monthly') {
      query = `
        WITH monthly_stats AS (
          SELECT 
            s.id,
            s.username,
            s.level,
            s.xp,
            COALESCE(SUM(ss.duration_minutes), 0) as total_study_time,
            COUNT(ss.id) as total_sessions,
            s.current_streak,
            ROW_NUMBER() OVER (ORDER BY SUM(ss.duration_minutes) DESC) as rank
          FROM students s
          LEFT JOIN study_sessions ss ON s.id = ss.student_id 
            AND ss.start_time >= date_trunc('month', CURRENT_DATE)
            AND ss.status = 'completed'
          GROUP BY s.id, s.username, s.level, s.xp, s.current_streak
        )
        SELECT * FROM monthly_stats WHERE id = $1
      `;
    }

    const result = await db.query(query, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      period,
      rank: result.rows[0]
    });

  } catch (error) {
    console.error('My rank error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rank',
      error: error.message
    });
  }
});

module.exports = router;