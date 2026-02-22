const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET /api/student/profile - Get student profile
// ============================================
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // Support both req.student and req.user for compatibility
    const studentId = req.student?.id || req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

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
        form_level,
        age_tier,
        daily_time_limit_minutes,
        onboarding_completed,
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
      student: profile
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
    // Support both req.student and req.user for compatibility
    const studentId = req.student?.id || req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const { 
      username, 
      email, 
      full_name, 
      bio, 
      avatar_url, 
      form_level, 
      onboarding_completed 
    } = req.body;

    console.log('📝 Update profile request:', { studentId, form_level, onboarding_completed });

    // Validate input - at least one field required
    const hasUpdate = username || email || full_name !== undefined || 
                      bio !== undefined || avatar_url !== undefined || 
                      form_level || onboarding_completed !== undefined;

    if (!hasUpdate) {
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

    // Determine age_tier and daily_time_limit based on form_level
    let age_tier = null;
    let daily_time_limit = null;

    if (form_level) {
      const validLevels = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
      if (!validLevels.includes(form_level)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid form level. Must be P1-P6 or S1-S6'
        });
      }

      // Determine age tier and daily limits
      if (['P1', 'P2', 'P3'].includes(form_level)) {
        age_tier = 'P1-P3';
        daily_time_limit = 15;
      } else if (['P4', 'P5', 'P6'].includes(form_level)) {
        age_tier = 'P4-P6';
        daily_time_limit = 25;
      } else if (['S1', 'S2', 'S3'].includes(form_level)) {
        age_tier = 'S1-S3';
        daily_time_limit = 40;
      } else if (['S4', 'S5', 'S6'].includes(form_level)) {
        age_tier = 'S4-S6';
        daily_time_limit = 60;
      }

      console.log('📊 Calculated tier:', { form_level, age_tier, daily_time_limit });
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

    // Handle form_level and related fields
    if (form_level) {
      updateFields.push(`form_level = $${paramCount}`);
      values.push(form_level);
      paramCount++;

      updateFields.push(`age_tier = $${paramCount}`);
      values.push(age_tier);
      paramCount++;

      updateFields.push(`daily_time_limit_minutes = $${paramCount}`);
      values.push(daily_time_limit);
      paramCount++;
    }

    // Handle onboarding_completed
    if (onboarding_completed !== undefined) {
      updateFields.push(`onboarding_completed = $${paramCount}`);
      values.push(onboarding_completed);
      paramCount++;
    }

    // Add student ID as last parameter
    values.push(studentId);

    const updateQuery = `
      UPDATE students 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id, 
        username, 
        email, 
        full_name, 
        bio, 
        avatar_url, 
        level, 
        xp, 
        current_streak, 
        longest_streak, 
        total_study_time,
        form_level, 
        age_tier, 
        daily_time_limit_minutes, 
        onboarding_completed
    `;

    console.log('📝 Executing query with values:', values);

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log('✅ Profile updated successfully:', result.rows[0]);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      student: result.rows[0],
      profile: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Update profile error:', error);

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
    const studentId = req.student?.id || req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

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
        form_level,
        age_tier,
        daily_time_limit_minutes,
        onboarding_completed,
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
    const studentId = req.student?.id || req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // Get all achievements with unlock status
    const achievementsQuery = await query(
      `SELECT 
        a.id,
        a.name,
        a.description,
        a.icon,
        a.category,
        a.points_reward,
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

// ============================================
// GET /api/student/schedule-status - Get current schedule status
// ============================================
router.get('/schedule-status', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // Get student info
    const studentResult = await query(`
      SELECT 
        form_level,
        age_tier,
        daily_time_limit_minutes,
        onboarding_completed
      FROM students
      WHERE id = $1
    `, [studentId]);

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const student = studentResult.rows[0];

    // Check if today is a rest day
    const restDayResult = await query(`
      SELECT is_rest_day 
      FROM student_schedules 
      WHERE student_id = $1 
      AND day_of_week = EXTRACT(DOW FROM CURRENT_DATE)
    `, [studentId]);

    const isRestDay = restDayResult.rows.length > 0 && restDayResult.rows[0].is_rest_day;

    // Get today's usage
    const usageResult = await query(`
      SELECT COALESCE(SUM(actual_minutes), 0)::int AS today_minutes
      FROM daily_session_log 
      WHERE student_id = $1 
      AND session_date = CURRENT_DATE
      AND session_ended_at IS NOT NULL
    `, [studentId]);

    const todayUsed = usageResult.rows[0]?.today_minutes || 0;
    const dailyLimit = student.daily_time_limit_minutes || 25;
    const remaining = Math.max(0, dailyLimit - todayUsed);

    res.json({
      success: true,
      status: {
        onboardingCompleted: student.onboarding_completed,
        formLevel: student.form_level,
        ageTier: student.age_tier,
        dailyLimit,
        todayUsed,
        remaining,
        isRestDay,
        canStudy: student.onboarding_completed && !isRestDay && remaining > 0
      }
    });

  } catch (error) {
    console.error('Get schedule status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get schedule status',
      error: error.message
    });
  }
});

// ============================================
// GET /api/student/schedule - Get student's weekly schedule
// ============================================
router.get('/schedule', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // Get schedule from student_schedules table
    const result = await query(`
      SELECT 
        day_of_week,
        is_rest_day,
        study_start_time,
        study_end_time
      FROM student_schedules
      WHERE student_id = $1
      ORDER BY day_of_week
    `, [studentId]);

    // If no schedule exists, create default schedule
    if (result.rows.length === 0) {
      const defaultSchedule = [];
      for (let i = 0; i < 7; i++) {
        defaultSchedule.push({
          student_id: studentId,
          day_of_week: i,
          is_rest_day: i === 0, // Sunday is default rest day
          study_start_time: '09:00:00',
          study_end_time: '17:00:00'
        });
        
        await query(`
          INSERT INTO student_schedules (student_id, day_of_week, is_rest_day, study_start_time, study_end_time)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (student_id, day_of_week) DO NOTHING
        `, [studentId, i, i === 0, '09:00:00', '17:00:00']);
      }
      
      return res.json({
        success: true,
        schedule: defaultSchedule
      });
    }

    res.json({
      success: true,
      schedule: result.rows
    });

  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get schedule',
      error: error.message
    });
  }
});

// ============================================
// PUT /api/student/schedule - Update student's weekly schedule
// ============================================
router.put('/schedule', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const { schedule } = req.body;

    if (!schedule || !Array.isArray(schedule)) {
      return res.status(400).json({
        success: false,
        message: 'Schedule array is required'
      });
    }

    // Validate schedule data
    for (const day of schedule) {
      if (typeof day.day_of_week !== 'number' || day.day_of_week < 0 || day.day_of_week > 6) {
        return res.status(400).json({
          success: false,
          message: 'Invalid day_of_week. Must be 0-6.'
        });
      }
    }

    // Update or insert schedule for each day
    const results = [];
    for (const day of schedule) {
      const result = await query(`
        INSERT INTO student_schedules (student_id, day_of_week, is_rest_day, study_start_time, study_end_time)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (student_id, day_of_week) 
        DO UPDATE SET 
          is_rest_day = EXCLUDED.is_rest_day,
          study_start_time = EXCLUDED.study_start_time,
          study_end_time = EXCLUDED.study_end_time,
          updated_at = CURRENT_TIMESTAMP
        RETURNING day_of_week, is_rest_day, study_start_time, study_end_time
      `, [
        studentId,
        day.day_of_week,
        day.is_rest_day,
        day.study_start_time || '09:00:00',
        day.study_end_time || '17:00:00'
      ]);
      
      results.push(result.rows[0]);
    }

    console.log(`✅ Schedule updated for student ${studentId}`);

    res.json({
      success: true,
      message: 'Schedule updated successfully',
      schedule: results
    });

  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update schedule',
      error: error.message
    });
  }
});

// ============================================
// POST /api/student/rest-day - Record a rest day and apply benefits
// ============================================
router.post('/rest-day', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const { restDate, benefits } = req.body;
    const date = restDate || new Date().toISOString().split('T')[0];

    // Record rest day in database
    await query(`
      INSERT INTO rest_days (student_id, rest_date, benefits_applied, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id, rest_date) DO NOTHING
    `, [studentId, date, JSON.stringify(benefits)]);

    // Apply streak protection if enabled
    if (benefits?.streakProtection) {
      await query(`
        INSERT INTO streak_protection (student_id, protected_date, reason)
        VALUES ($1, $2, 'rest_day')
        ON CONFLICT DO NOTHING
      `, [studentId, date]);
    }

    res.json({
      success: true,
      message: 'Rest day recorded successfully',
      benefits: {
        xpBoost: benefits?.xpBoost || 1.5,
        streakProtection: benefits?.streakProtection || true,
        energyRestore: benefits?.energyRestore || true
      }
    });

  } catch (error) {
    console.error('Rest day error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record rest day',
      error: error.message
    });
  }
});

module.exports = router;