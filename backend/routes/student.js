const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth'); // ✅ Changed here

// GET /api/student/profile - Get student profile
router.get('/profile', authenticateToken, async (req, res) => { // ✅ Changed here
  try {
    const studentId = req.student.id; // ✅ Changed from req.user.id to req.student.id

    const result = await query(
      `SELECT id, username, email, level, xp, current_streak, longest_streak, 
              total_study_time, created_at
       FROM students 
       WHERE id = $1`,
      [studentId]
    );

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
      message: 'Failed to retrieve profile',
      error: error.message
    });
  }
});

// PUT /api/student/profile - Update student profile
router.put('/profile', authenticateToken, async (req, res) => { // ✅ Changed here
  try {
    const studentId = req.student.id; // ✅ Changed from req.user.id
    const { username, email } = req.body;

    // Validate input
    if (!username && !email) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (username or email) is required'
      });
    }

    // Build dynamic update query
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (username) {
      updateFields.push(`username = $${paramCount}`);
      values.push(username);
      paramCount++;
    }

    if (email) {
      updateFields.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    values.push(studentId);

    const updateQuery = `
      UPDATE students 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, level, xp, current_streak, longest_streak, total_study_time
    `;

    const result = await query(updateQuery, values);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      student: result.rows[0]
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// GET /api/student/stats - Get student statistics
// GET /api/student/stats - Get student statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    // Get student basic info
    const studentQuery = await query(
      `SELECT 
        id, username, email, level, xp, current_streak, longest_streak, 
        total_study_time, created_at
       FROM students 
       WHERE id = $1`,
      [studentId]
    );

    if (studentQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const student = studentQuery.rows[0];

    // Get total sessions count
    const sessionsQuery = await query(
      `SELECT COUNT(*) as total_sessions,
              COALESCE(SUM(duration), 0) as total_minutes,
              COALESCE(SUM(xp_earned), 0) as total_session_xp
       FROM study_sessions 
       WHERE student_id = $1 AND ended_at IS NOT NULL`,
      [studentId]
    );

    // Get sessions today
    const todayQuery = await query(
      `SELECT COUNT(*) as sessions_today
       FROM study_sessions 
       WHERE student_id = $1 
       AND DATE(started_at) = CURRENT_DATE`,
      [studentId]
    );

    // Get achievements count
    const achievementsQuery = await query(
      `SELECT COUNT(*) as unlocked_count
       FROM student_achievements 
       WHERE student_id = $1`,
      [studentId]
    );

    // Get recent sessions (last 7 days) - ✅ Removed pause_count
    const recentSessionsQuery = await query(
      `SELECT 
        id, subject, started_at, ended_at, duration, xp_earned, created_at
       FROM study_sessions 
       WHERE student_id = $1 
       AND started_at >= NOW() - INTERVAL '7 days'
       ORDER BY started_at DESC 
       LIMIT 10`,
      [studentId]
    );

    // Combine all data
    const stats = {
      ...student,
      total_sessions: parseInt(sessionsQuery.rows[0].total_sessions) || 0,
      total_minutes: parseInt(sessionsQuery.rows[0].total_minutes) || 0,
      total_session_xp: parseInt(sessionsQuery.rows[0].total_session_xp) || 0,
      sessions_today: parseInt(todayQuery.rows[0].sessions_today) || 0,
      unlocked_achievements: parseInt(achievementsQuery.rows[0].unlocked_count) || 0,
      recent_sessions: recentSessionsQuery.rows
    };

    res.json({
      success: true,
      student: stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics',
      error: error.message
    });
  }
});

module.exports = router;