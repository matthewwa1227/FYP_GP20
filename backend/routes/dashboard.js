const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { getLevelProgress, calculateDailyGoalProgress } = require('../utils/gamification');

// ============================================
// GET /api/dashboard - Main Dashboard Data
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    // 1. Get student profile with stats
    const studentResult = await db.query(`
      SELECT 
        id, username, email, level, xp, 
        total_study_time, total_sessions, total_points,
        current_streak, longest_streak,
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

    const student = studentResult.rows[0];

    // 2. Get today's study time
    const todayResult = await db.query(`
      SELECT COALESCE(SUM(duration), 0) as today_minutes
      FROM study_sessions
      WHERE student_id = $1 
      AND DATE(started_at) = CURRENT_DATE
      AND status = 'completed'
    `, [studentId]);

    const todayMinutes = parseInt(todayResult.rows[0].today_minutes);

    // 3. Get this week's study time
    const weekResult = await db.query(`
      SELECT COALESCE(SUM(duration), 0) as week_minutes
      FROM study_sessions
      WHERE student_id = $1 
      AND started_at >= date_trunc('week', CURRENT_DATE)
      AND status = 'completed'
    `, [studentId]);

    const weekMinutes = parseInt(weekResult.rows[0].week_minutes);

    // 4. Get recent sessions (last 5)
    const sessionsResult = await db.query(`
      SELECT 
        id, subject, topic, duration, 
        xp_earned, started_at, ended_at, status
      FROM study_sessions
      WHERE student_id = $1
      ORDER BY started_at DESC
      LIMIT 5
    `, [studentId]);

    // 5. Get active session (if any)
    const activeSessionResult = await db.query(`
      SELECT id, subject, topic, started_at, status
      FROM study_sessions
      WHERE student_id = $1 AND status = 'active'
      LIMIT 1
    `, [studentId]);

    // 6. Get unlocked achievements count
    const achievementsResult = await db.query(`
      SELECT COUNT(*) as unlocked_count
      FROM student_achievements
      WHERE student_id = $1
    `, [studentId]);

    const unlockedAchievements = parseInt(achievementsResult.rows[0].unlocked_count);

    // 7. Calculate level progress
    const levelProgress = getLevelProgress(student.xp, student.level);

    // 8. Calculate daily goal progress (default goal: 60 minutes)
    const dailyGoal = calculateDailyGoalProgress(todayMinutes, 60);

    // 9. Get weekly study distribution
    const weeklyDistribution = await db.query(`
      SELECT 
        TO_CHAR(DATE(started_at), 'Day') as day_name,
        EXTRACT(DOW FROM started_at) as day_number,
        COALESCE(SUM(duration), 0) as minutes
      FROM study_sessions
      WHERE student_id = $1 
      AND started_at >= date_trunc('week', CURRENT_DATE)
      AND status = 'completed'
      GROUP BY DATE(started_at), day_name, day_number
      ORDER BY day_number
    `, [studentId]);

    // 10. Get subject breakdown
    const subjectBreakdown = await db.query(`
      SELECT 
        subject,
        COUNT(*) as session_count,
        SUM(duration) as total_minutes
      FROM study_sessions
      WHERE student_id = $1 AND status = 'completed'
      GROUP BY subject
      ORDER BY total_minutes DESC
      LIMIT 5
    `, [studentId]);

    // 11. Get last study date from most recent session
    const lastStudyResult = await db.query(`
      SELECT MAX(started_at) as last_study_date
      FROM study_sessions
      WHERE student_id = $1 AND status = 'completed'
    `, [studentId]);

    const lastStudyDate = lastStudyResult.rows[0].last_study_date;

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          username: student.username,
          email: student.email,
          level: student.level,
          xp: student.xp,
          totalStudyTime: student.total_study_time,
          totalSessions: student.total_sessions,
          totalPoints: student.total_points,
          currentStreak: student.current_streak,
          longestStreak: student.longest_streak,
          lastStudyDate: lastStudyDate,
          memberSince: student.created_at
        },
        levelProgress,
        dailyGoal,
        stats: {
          today: todayMinutes,
          thisWeek: weekMinutes,
          allTime: student.total_study_time,
          sessions: student.total_sessions,
          achievements: unlockedAchievements
        },
        recentSessions: sessionsResult.rows,
        activeSession: activeSessionResult.rows[0] || null,
        weeklyDistribution: weeklyDistribution.rows,
        subjectBreakdown: subjectBreakdown.rows
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

// ============================================
// GET /api/dashboard/stats/weekly - Weekly Stats
// ============================================
router.get('/stats/weekly', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    const result = await db.query(`
      SELECT 
        TO_CHAR(DATE(started_at), 'Day') as day,
        COALESCE(SUM(duration), 0) as minutes,
        COUNT(*) as sessions
      FROM study_sessions
      WHERE student_id = $1 
      AND started_at >= date_trunc('week', CURRENT_DATE)
      AND status = 'completed'
      GROUP BY DATE(started_at), day
      ORDER BY DATE(started_at)
    `, [studentId]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Weekly stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly stats',
      error: error.message
    });
  }
});

module.exports = router;