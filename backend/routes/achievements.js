const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET /api/achievements - Get All Achievements
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, name, description, icon, category,
        requirement_type, requirement_value,
        points_reward, badge_tier,
        created_at
      FROM achievements
      ORDER BY 
        CASE badge_tier
          WHEN 'bronze' THEN 1
          WHEN 'silver' THEN 2
          WHEN 'gold' THEN 3
          WHEN 'platinum' THEN 4
        END,
        requirement_value ASC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      achievements: result.rows
    });

  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievements',
      error: error.message
    });
  }
});

// ============================================
// GET /api/achievements/student - Get Student's Achievements
// ============================================
router.get('/student', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    // Get all achievements with unlock status
    const result = await db.query(`
      SELECT 
        a.id,
        a.name,
        a.description,
        a.icon,
        a.category,
        a.requirement_type,
        a.requirement_value,
        a.points_reward,
        a.badge_tier,
        sa.unlocked_at,
        CASE WHEN sa.id IS NOT NULL THEN true ELSE false END as unlocked
      FROM achievements a
      LEFT JOIN student_achievements sa 
        ON a.id = sa.achievement_id AND sa.student_id = $1
      ORDER BY 
        unlocked DESC,
        CASE a.badge_tier
          WHEN 'bronze' THEN 1
          WHEN 'silver' THEN 2
          WHEN 'gold' THEN 3
          WHEN 'platinum' THEN 4
        END,
        a.requirement_value ASC
    `, [studentId]);

    const achievements = result.rows;
    const unlocked = achievements.filter(a => a.unlocked);
    const locked = achievements.filter(a => !a.unlocked);

    res.json({
      success: true,
      total: achievements.length,
      unlocked: unlocked.length,
      locked: locked.length,
      achievements,
      unlockedAchievements: unlocked,
      lockedAchievements: locked
    });

  } catch (error) {
    console.error('Get student achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student achievements',
      error: error.message
    });
  }
});

// ============================================
// POST /api/achievements/check - Check & Unlock Achievements
// ============================================
router.post('/check', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    // Get student stats
    const studentResult = await db.query(`
      SELECT 
        total_sessions, total_study_time, current_streak
      FROM students
      WHERE id = $1
    `, [studentId]);

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const stats = studentResult.rows[0];
    
    // 🔧 ADD THIS: Get max session duration for single_session_minutes achievements
    const maxSessionResult = await db.query(`
      SELECT MAX(duration) as max_duration
      FROM study_sessions
      WHERE student_id = $1 AND status = 'completed'
    `, [studentId]);
    
    const maxSessionDuration = maxSessionResult.rows[0]?.max_duration || 0;
    
    const newlyUnlocked = [];

    // Get all achievements not yet unlocked
    const achievementsResult = await db.query(`
      SELECT a.*
      FROM achievements a
      WHERE NOT EXISTS (
        SELECT 1 FROM student_achievements sa
        WHERE sa.achievement_id = a.id AND sa.student_id = $1
      )
    `, [studentId]);

    // Check each achievement
    for (const achievement of achievementsResult.rows) {
      let unlocked = false;

      switch (achievement.requirement_type) {
        case 'sessions_count':
          unlocked = stats.total_sessions >= achievement.requirement_value;
          break;
        case 'total_minutes':
          unlocked = stats.total_study_time >= achievement.requirement_value;
          break;
        case 'streak_days':
          unlocked = stats.current_streak >= achievement.requirement_value;
          break;
        // 🔧 ADD THIS CASE:
        case 'single_session_minutes':
          unlocked = maxSessionDuration >= achievement.requirement_value;
          break;
      }

      if (unlocked) {
        // Unlock the achievement
        await db.query(`
          INSERT INTO student_achievements (student_id, achievement_id, unlocked_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (student_id, achievement_id) DO NOTHING
        `, [studentId, achievement.id]);

        // Award points
        await db.query(`
          UPDATE students
          SET total_points = total_points + $1
          WHERE id = $2
        `, [achievement.points_reward, studentId]);

        newlyUnlocked.push({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          pointsRewarded: achievement.points_reward,
          tier: achievement.badge_tier
        });
      }
    }

    res.json({
      success: true,
      newlyUnlocked: newlyUnlocked.length,
      achievements: newlyUnlocked
    });

  } catch (error) {
    console.error('Check achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check achievements',
      error: error.message
    });
  }
});

module.exports = router;