const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET /api/progress/dashboard - Get comprehensive progress dashboard
// ============================================
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;

    // Get current goals
    const goalsResult = await query(`
      SELECT 
        id, title, goal_type, target_metric, target_value, current_value,
        progress_percentage, status, reward_xp, end_date
      FROM student_goals
      WHERE student_id = $1 AND status = 'active'
      ORDER BY end_date ASC
    `, [studentId]);

    // Get progress tracking for last 30 days
    const progressResult = await query(`
      SELECT 
        tracking_date, total_minutes, total_sessions, total_xp_earned,
        questions_answered, correct_answers, accuracy_rate,
        subject_breakdown, skills_improved
      FROM progress_tracking
      WHERE student_id = $1 AND tracking_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY tracking_date DESC
    `, [studentId]);

    // Get weekly summary
    const weeklyResult = await query(`
      SELECT 
        tracking_week, tracking_year,
        SUM(total_minutes) as week_minutes,
        SUM(total_sessions) as week_sessions,
        SUM(total_xp_earned) as week_xp,
        AVG(accuracy_rate) as week_accuracy
      FROM progress_tracking
      WHERE student_id = $1 
        AND tracking_year = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY tracking_week, tracking_year
      ORDER BY tracking_year DESC, tracking_week DESC
      LIMIT 4
    `, [studentId]);

    // Calculate streaks and trends
    const streakResult = await query(`
      SELECT 
        current_streak,
        longest_streak,
        total_study_time,
        total_sessions,
        level,
        xp
      FROM students
      WHERE id = $1
    `, [studentId]);

    // Subject-wise breakdown
    const subjectResult = await query(`
      SELECT 
        subject,
        SUM(duration) as total_minutes,
        COUNT(*) as sessions,
        AVG(CASE WHEN questions_answered > 0 
          THEN (correct_answers::DECIMAL / questions_answered) * 100 
          ELSE 0 END) as avg_accuracy
      FROM study_sessions
      WHERE student_id = $1 AND started_at >= NOW() - INTERVAL '30 days'
      GROUP BY subject
      ORDER BY total_minutes DESC
    `, [studentId]);

    res.json({
      success: true,
      data: {
        goals: goalsResult.rows,
        dailyProgress: progressResult.rows,
        weeklySummary: weeklyResult.rows,
        stats: streakResult.rows[0],
        subjects: subjectResult.rows,
        summary: {
          totalGoals: goalsResult.rowCount,
          completedGoalsThisMonth: goalsResult.rows.filter(g => g.status === 'completed').length,
          averageAccuracy: progressResult.rows.length > 0 
            ? (progressResult.rows.reduce((sum, p) => sum + (p.accuracy_rate || 0), 0) / progressResult.rows.length).toFixed(1)
            : 0,
          totalStudyHours: Math.floor((progressResult.rows.reduce((sum, p) => sum + (p.total_minutes || 0), 0)) / 60)
        }
      }
    });

  } catch (error) {
    console.error('Progress dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load progress dashboard' });
  }
});

// ============================================
// POST /api/progress/goals - Create a new goal
// ============================================
router.post('/goals', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const {
      title, description, goalType, targetMetric, targetValue,
      subject, topic, endDate, rewardXp
    } = req.body;

    const result = await query(`
      INSERT INTO student_goals (
        student_id, title, description, goal_type, target_metric, target_value,
        subject, topic, end_date, reward_xp, created_by, is_approved
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $1, TRUE)
      RETURNING *
    `, [studentId, title, description, goalType, targetMetric, targetValue, subject, topic, endDate, rewardXp || 0]);

    res.json({ success: true, goal: result.rows[0] });

  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ success: false, message: 'Failed to create goal' });
  }
});

// ============================================
// GET /api/progress/goals - Get all goals
// ============================================
router.get('/goals', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const { status, type } = req.query;

    let sql = `
      SELECT 
        g.*,
        s.username as created_by_name
      FROM student_goals g
      LEFT JOIN students s ON g.created_by = s.id
      WHERE g.student_id = $1
    `;
    const params = [studentId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND g.status = $${paramIndex++}`;
      params.push(status);
    }

    if (type) {
      sql += ` AND g.goal_type = $${paramIndex++}`;
      params.push(type);
    }

    sql += ` ORDER BY g.created_at DESC`;

    const result = await query(sql, params);

    res.json({ success: true, goals: result.rows });

  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ success: false, message: 'Failed to load goals' });
  }
});

// ============================================
// PUT /api/progress/goals/:id - Update goal progress
// ============================================
router.put('/goals/:id', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const goalId = req.params.id;
    const { currentValue, status } = req.body;

    // Get current goal
    const goalResult = await query(`
      SELECT * FROM student_goals WHERE id = $1 AND student_id = $2
    `, [goalId, studentId]);

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const goal = goalResult.rows[0];
    let newStatus = status || goal.status;
    let newProgress = 0;

    if (currentValue !== undefined) {
      newProgress = Math.min(100, Math.round((currentValue / goal.target_value) * 100));
      if (currentValue >= goal.target_value && goal.status !== 'completed') {
        newStatus = 'completed';
      }
    }

    const result = await query(`
      UPDATE student_goals
      SET current_value = COALESCE($1, current_value),
          progress_percentage = $2,
          status = $3,
          completed_at = CASE WHEN $3 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND student_id = $5
      RETURNING *
    `, [currentValue, newProgress, newStatus, goalId, studentId]);

    // If goal completed, award XP
    if (newStatus === 'completed' && goal.status !== 'completed') {
      await query(`
        UPDATE students SET xp = xp + $1 WHERE id = $2
      `, [goal.reward_xp || 0, studentId]);
    }

    res.json({ success: true, goal: result.rows[0] });

  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ success: false, message: 'Failed to update goal' });
  }
});

// ============================================
// DELETE /api/progress/goals/:id - Delete goal
// ============================================
router.delete('/goals/:id', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const goalId = req.params.id;

    await query(`
      DELETE FROM student_goals WHERE id = $1 AND student_id = $2
    `, [goalId, studentId]);

    res.json({ success: true, message: 'Goal deleted' });

  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete goal' });
  }
});

// ============================================
// GET /api/progress/analytics - Get detailed analytics
// ============================================
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const { period = '30days' } = req.query;

    let interval = '30 days';
    if (period === '7days') interval = '7 days';
    if (period === '90days') interval = '90 days';

    // Study pattern analysis
    const patternResult = await query(`
      SELECT 
        EXTRACT(HOUR FROM started_at) as hour,
        COUNT(*) as sessions,
        AVG(duration) as avg_duration,
        SUM(xp_earned) as total_xp
      FROM study_sessions
      WHERE student_id = $1 AND started_at >= NOW() - INTERVAL '${interval}'
      GROUP BY EXTRACT(HOUR FROM started_at)
      ORDER BY hour
    `, [studentId]);

    // Skill progression
    const skillResult = await query(`
      SELECT 
        subject,
        DATE_TRUNC('week', started_at) as week,
        AVG(CASE WHEN questions_answered > 0 
          THEN (correct_answers::DECIMAL / questions_answered) * 100 
          ELSE NULL END) as accuracy,
        SUM(duration) as minutes
      FROM study_sessions
      WHERE student_id = $1 AND started_at >= NOW() - INTERVAL '${interval}'
      GROUP BY subject, DATE_TRUNC('week', started_at)
      ORDER BY subject, week
    `, [studentId]);

    // Comparison with peers (anonymized)
    const peerResult = await query(`
      SELECT 
        AVG(total_study_minutes) as peer_avg_minutes,
        AVG(total_sessions) as peer_avg_sessions,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_study_minutes) as median_minutes
      FROM (
        SELECT 
          student_id,
          SUM(duration) as total_study_minutes,
          COUNT(*) as total_sessions
        FROM study_sessions
        WHERE started_at >= NOW() - INTERVAL '${interval}'
        GROUP BY student_id
      ) peer_stats
    `);

    res.json({
      success: true,
      analytics: {
        studyPatterns: patternResult.rows,
        skillProgression: skillResult.rows,
        peerComparison: peerResult.rows[0],
        period
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load analytics' });
  }
});

module.exports = router;
