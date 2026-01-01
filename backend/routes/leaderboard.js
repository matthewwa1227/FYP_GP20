const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET /api/leaderboard - Main leaderboard endpoint (for frontend component)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      timeFilter = 'all', 
      sortBy = 'points', 
      page = 1, 
      limit = 10 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const studentId = req.student.id;

    // Determine sort column based on sortBy parameter
    let sortColumn;
    switch (sortBy) {
      case 'study_time':
        sortColumn = 'total_study_time';
        break;
      case 'streak':
        sortColumn = 'current_streak';
        break;
      case 'points':
      default:
        sortColumn = 'total_points';
        break;
    }

    let leaderboardQuery;
    let countQuery;

    if (timeFilter === 'all') {
      // All-time leaderboard using stored totals
      leaderboardQuery = `
        SELECT 
          s.id,
          s.username,
          s.level as current_level,
          s.xp,
          COALESCE(s.total_points, s.xp) as total_points,
          COALESCE(s.total_study_time, 0) as total_study_minutes,
          COALESCE(s.total_sessions, 0) as total_sessions,
          COALESCE(s.current_streak, 0) as streak_days,
          ROW_NUMBER() OVER (ORDER BY ${sortColumn === 'total_points' ? 'COALESCE(s.total_points, s.xp)' : `COALESCE(s.${sortColumn}, 0)`} DESC, s.xp DESC) as rank
        FROM students s
        ORDER BY ${sortColumn === 'total_points' ? 'COALESCE(s.total_points, s.xp)' : `COALESCE(s.${sortColumn}, 0)`} DESC, s.xp DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = `SELECT COUNT(*) FROM students`;
    } else {
      // Time-filtered leaderboard (weekly/monthly)
      let dateFilter;
      if (timeFilter === 'weekly') {
        dateFilter = "ss.started_at >= date_trunc('week', CURRENT_DATE)";
      } else {
        dateFilter = "ss.started_at >= date_trunc('month', CURRENT_DATE)";
      }

      leaderboardQuery = `
        WITH period_stats AS (
          SELECT 
            s.id,
            s.username,
            s.level as current_level,
            s.xp,
            s.current_streak as streak_days,
            COALESCE(SUM(ss.xp_earned), 0) as total_points,
            COALESCE(SUM(ss.duration), 0) as total_study_minutes,
            COUNT(ss.id) as total_sessions
          FROM students s
          LEFT JOIN study_sessions ss ON s.id = ss.student_id 
            AND ${dateFilter}
            AND ss.ended_at IS NOT NULL
          GROUP BY s.id, s.username, s.level, s.xp, s.current_streak
        )
        SELECT 
          *,
          ROW_NUMBER() OVER (ORDER BY ${sortColumn === 'streak_days' ? 'streak_days' : sortColumn} DESC, xp DESC) as rank
        FROM period_stats
        ORDER BY ${sortColumn === 'streak_days' ? 'streak_days' : sortColumn} DESC, xp DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = `SELECT COUNT(*) FROM students`;
    }

    // Execute leaderboard query
    const leaderboardResult = await db.query(leaderboardQuery, [parseInt(limit), offset]);

    // Get total count for pagination
    const countResult = await db.query(countQuery);
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Get current user's rank
    let userRankQuery;
    if (timeFilter === 'all') {
      userRankQuery = `
        WITH ranked_students AS (
          SELECT 
            id,
            COALESCE(total_points, xp) as total_points,
            COALESCE(total_study_time, 0) as total_study_minutes,
            COALESCE(current_streak, 0) as streak_days,
            ROW_NUMBER() OVER (ORDER BY ${sortColumn === 'total_points' ? 'COALESCE(total_points, xp)' : `COALESCE(${sortColumn}, 0)`} DESC, xp DESC) as rank
          FROM students
        )
        SELECT * FROM ranked_students WHERE id = $1
      `;
    } else {
      let dateFilter = timeFilter === 'weekly' 
        ? "ss.started_at >= date_trunc('week', CURRENT_DATE)"
        : "ss.started_at >= date_trunc('month', CURRENT_DATE)";

      userRankQuery = `
        WITH period_stats AS (
          SELECT 
            s.id,
            s.current_streak as streak_days,
            COALESCE(SUM(ss.xp_earned), 0) as total_points,
            COALESCE(SUM(ss.duration), 0) as total_study_minutes
          FROM students s
          LEFT JOIN study_sessions ss ON s.id = ss.student_id 
            AND ${dateFilter}
            AND ss.ended_at IS NOT NULL
          GROUP BY s.id, s.current_streak
        ),
        ranked AS (
          SELECT 
            *,
            ROW_NUMBER() OVER (ORDER BY ${sortColumn === 'streak_days' ? 'streak_days' : sortColumn} DESC) as rank
          FROM period_stats
        )
        SELECT * FROM ranked WHERE id = $1
      `;
    }

    const userRankResult = await db.query(userRankQuery, [studentId]);

    res.json({
      success: true,
      leaderboard: leaderboardResult.rows,
      userRank: userRankResult.rows[0] || null,
      totalPages,
      currentPage: parseInt(page),
      totalCount
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
// GET /api/leaderboard/global - Global Leaderboard (legacy/alternative)
// ============================================
router.get('/global', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const period = req.query.period || 'all-time';

    let query;

    if (period === 'all-time') {
      query = `
        SELECT 
          s.id,
          s.username,
          s.level,
          s.xp,
          COALESCE(s.total_points, s.xp) as total_points,
          COALESCE(s.total_study_time, 0) as total_study_time,
          COALESCE(s.total_sessions, 0) as total_sessions,
          COALESCE(s.current_streak, 0) as current_streak,
          ROW_NUMBER() OVER (ORDER BY COALESCE(s.total_points, s.xp) DESC, s.xp DESC) as rank
        FROM students s
        ORDER BY rank
        LIMIT $1
      `;
    } else if (period === 'weekly') {
      query = `
        SELECT 
          s.id,
          s.username,
          s.level,
          s.xp,
          COALESCE(SUM(ss.xp_earned), 0) as total_points,
          COALESCE(SUM(ss.duration), 0) as total_study_time,
          COUNT(ss.id) as total_sessions,
          COALESCE(s.current_streak, 0) as current_streak,
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ss.xp_earned), 0) DESC) as rank
        FROM students s
        LEFT JOIN study_sessions ss ON s.id = ss.student_id 
          AND ss.started_at >= date_trunc('week', CURRENT_DATE)
          AND ss.ended_at IS NOT NULL
        GROUP BY s.id, s.username, s.level, s.xp, s.current_streak
        ORDER BY rank
        LIMIT $1
      `;
    } else if (period === 'monthly') {
      query = `
        SELECT 
          s.id,
          s.username,
          s.level,
          s.xp,
          COALESCE(SUM(ss.xp_earned), 0) as total_points,
          COALESCE(SUM(ss.duration), 0) as total_study_time,
          COUNT(ss.id) as total_sessions,
          COALESCE(s.current_streak, 0) as current_streak,
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ss.xp_earned), 0) DESC) as rank
        FROM students s
        LEFT JOIN study_sessions ss ON s.id = ss.student_id 
          AND ss.started_at >= date_trunc('month', CURRENT_DATE)
          AND ss.ended_at IS NOT NULL
        GROUP BY s.id, s.username, s.level, s.xp, s.current_streak
        ORDER BY rank
        LIMIT $1
      `;
    }

    const result = await db.query(query, [limit]);

    res.json({
      success: true,
      period,
      count: result.rows.length,
      leaderboard: result.rows
    });

  } catch (error) {
    console.error('Global leaderboard error:', error);
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
            COALESCE(total_points, xp) as total_points,
            COALESCE(total_study_time, 0) as total_study_time,
            COALESCE(total_sessions, 0) as total_sessions,
            COALESCE(current_streak, 0) as current_streak,
            ROW_NUMBER() OVER (ORDER BY COALESCE(total_points, xp) DESC, xp DESC) as rank
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
            COALESCE(SUM(ss.xp_earned), 0) as total_points,
            COALESCE(SUM(ss.duration), 0) as total_study_time,
            COUNT(ss.id) as total_sessions,
            COALESCE(s.current_streak, 0) as current_streak,
            ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ss.xp_earned), 0) DESC) as rank
          FROM students s
          LEFT JOIN study_sessions ss ON s.id = ss.student_id 
            AND ss.started_at >= date_trunc('week', CURRENT_DATE)
            AND ss.ended_at IS NOT NULL
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
            COALESCE(SUM(ss.xp_earned), 0) as total_points,
            COALESCE(SUM(ss.duration), 0) as total_study_time,
            COUNT(ss.id) as total_sessions,
            COALESCE(s.current_streak, 0) as current_streak,
            ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ss.xp_earned), 0) DESC) as rank
          FROM students s
          LEFT JOIN study_sessions ss ON s.id = ss.student_id 
            AND ss.started_at >= date_trunc('month', CURRENT_DATE)
            AND ss.ended_at IS NOT NULL
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

// ============================================
// GET /api/leaderboard/rank/:userId - Get specific user's rank
// ============================================
router.get('/rank/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      WITH ranked_students AS (
        SELECT 
          id,
          username,
          COALESCE(total_points, xp) as total_points,
          COALESCE(total_study_time, 0) as total_study_minutes,
          COALESCE(current_streak, 0) as streak_days,
          ROW_NUMBER() OVER (ORDER BY COALESCE(total_points, xp) DESC, xp DESC) as rank
        FROM students
      )
      SELECT * FROM ranked_students WHERE id = $1
    `;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      userRank: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching user rank:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user rank' 
    });
  }
});

module.exports = router;