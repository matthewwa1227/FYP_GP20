const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET /api/student/profile - Get student profile
// ============================================
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    const result = await query(
      `SELECT 
        id, 
        username, 
        email, 
        full_name,
        bio,
        avatar_url,
        level, 
        xp, 
        COALESCE(total_points, xp) as total_points,
        current_streak, 
        longest_streak, 
        COALESCE(total_study_time, 0) as total_study_time,
        COALESCE(total_sessions, 0) as total_sessions,
        created_at
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

    // Get subject breakdown
    const subjectResult = await query(
      `SELECT 
        subject as name,
        COALESCE(SUM(duration), 0) as minutes,
        COUNT(*) as sessions
       FROM study_sessions
       WHERE student_id = $1 AND duration > 0
       GROUP BY subject
       ORDER BY minutes DESC`,
      [studentId]
    );

    const profile = {
      ...result.rows[0],
      subject_stats: subjectResult.rows
    };

    res.json({
      success: true,
      profile,
      student: profile // For backwards compatibility
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

// ============================================
// PUT /api/student/profile - Update student profile
// ============================================
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;
    const { username, email, full_name, bio, avatar_url } = req.body;

    // Validate input - at least one field required
    if (!username && !email && !full_name && bio === undefined && !avatar_url) {
      return res.status(400).json({
        success: false,
        message: 'At least one field is required to update'
      });
    }

    // Validate bio length
    if (bio && bio.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Bio must be 200 characters or less'
      });
    }

    // Validate avatar URL if provided
    if (avatar_url && avatar_url.length > 0) {
      try {
        new URL(avatar_url);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid avatar URL'
        });
      }
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

    if (full_name !== undefined) {
      updateFields.push(`full_name = $${paramCount}`);
      values.push(full_name || null);
      paramCount++;
    }

    if (bio !== undefined) {
      updateFields.push(`bio = $${paramCount}`);
      values.push(bio || null);
      paramCount++;
    }

    if (avatar_url !== undefined) {
      updateFields.push(`avatar_url = $${paramCount}`);
      values.push(avatar_url || null);
      paramCount++;
    }

    values.push(studentId);

    const updateQuery = `
      UPDATE students 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, full_name, bio, avatar_url, level, xp, current_streak, longest_streak, total_study_time
    `;

    const result = await query(updateQuery, values);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      student: result.rows[0],
      profile: result.rows[0]
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

// ============================================
// GET /api/student/stats - Get student statistics
// ============================================
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    // Get student basic info with all fields
    const studentQuery = await query(
      `SELECT 
        id, 
        username, 
        email, 
        full_name,
        bio,
        avatar_url,
        level, 
        xp, 
        COALESCE(total_points, xp) as total_points,
        current_streak, 
        longest_streak, 
        COALESCE(total_study_time, 0) as total_study_time,
        COALESCE(total_sessions, 0) as total_sessions,
        created_at
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

    // Get total sessions count from study_sessions
    const sessionsQuery = await query(
      `SELECT 
        COUNT(*) as total_sessions,
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

    // Get recent sessions (last 7 days)
    const recentSessionsQuery = await query(
      `SELECT 
        id, 
        subject, 
        started_at, 
        ended_at, 
        duration, 
        xp_earned, 
        created_at
       FROM study_sessions 
       WHERE student_id = $1 
       AND started_at >= NOW() - INTERVAL '7 days'
       ORDER BY started_at DESC 
       LIMIT 10`,
      [studentId]
    );

    // Get subject breakdown
    const subjectQuery = await query(
      `SELECT 
        subject as name,
        COALESCE(SUM(duration), 0) as minutes,
        COUNT(*) as sessions
       FROM study_sessions
       WHERE student_id = $1 AND duration > 0
       GROUP BY subject
       ORDER BY minutes DESC`,
      [studentId]
    );

    // Combine all data
    const stats = {
      ...student,
      total_sessions: parseInt(sessionsQuery.rows[0].total_sessions) || student.total_sessions || 0,
      total_minutes: parseInt(sessionsQuery.rows[0].total_minutes) || 0,
      total_study_minutes: parseInt(sessionsQuery.rows[0].total_minutes) || student.total_study_time || 0,
      total_session_xp: parseInt(sessionsQuery.rows[0].total_session_xp) || 0,
      sessions_today: parseInt(todayQuery.rows[0].sessions_today) || 0,
      unlocked_achievements: parseInt(achievementsQuery.rows[0].unlocked_count) || 0,
      recent_sessions: recentSessionsQuery.rows,
      subject_stats: subjectQuery.rows
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

// ============================================
// GET /api/student/achievements - Get student achievements
// ============================================
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    // Get all achievements with unlock status
    const achievementsQuery = await query(
      `SELECT 
        a.id,
        a.name,
        a.description,
        a.icon,
        a.category,
        a.points_reward,
        a.xp_reward,
        CASE WHEN sa.id IS NOT NULL THEN true ELSE false END as unlocked,
        sa.unlocked_at
       FROM achievements a
       LEFT JOIN student_achievements sa ON a.id = sa.achievement_id AND sa.student_id = $1
       ORDER BY sa.unlocked_at DESC NULLS LAST, a.id`,
      [studentId]
    );

    res.json({
      success: true,
      achievements: achievementsQuery.rows
    });

  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve achievements',
      error: error.message
    });
  }
});

module.exports = router;