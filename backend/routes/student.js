const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET /api/student/profile - Get Current Student Profile
// ============================================
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    const result = await db.query(`
      SELECT 
        id,
        username,
        email,
        level,
        xp,
        total_points,
        total_study_time,
        total_sessions,
        current_streak,
        longest_streak,
        created_at
      FROM students
      WHERE id = $1
    `, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      student: result.rows[0]
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// ============================================
// GET /api/student/stats - Get Detailed Stats
// ============================================
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    // Get basic stats
    const studentResult = await db.query(`
      SELECT 
        id, username, email, level, xp, total_points,
        total_study_time, total_sessions, current_streak, longest_streak,
        created_at
      FROM students
      WHERE id = $1
    `, [studentId]);

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get achievement count
    const achievementResult = await db.query(`
      SELECT COUNT(*) as unlocked_count
      FROM student_achievements
      WHERE student_id = $1
    `, [studentId]);

    // Get recent sessions
    const sessionsResult = await db.query(`
      SELECT id, subject, duration, focus_score, status, started_at, ended_at
      FROM study_sessions
      WHERE student_id = $1
      ORDER BY started_at DESC
      LIMIT 5
    `, [studentId]);

    const student = studentResult.rows[0];
    const achievementsUnlocked = parseInt(achievementResult.rows[0].unlocked_count);

    res.json({
      success: true,
      student: {
        ...student,
        achievements_unlocked: achievementsUnlocked
      },
      recentSessions: sessionsResult.rows
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message
    });
  }
});

module.exports = router;