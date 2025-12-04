const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../db/connection');

// ============================================
// GET /api/achievements - Get all achievements with progress
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const studentId = req.student.id;

    // Get all achievements with student's progress
    const achievementsQuery = `
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
        sa.progress,
        CASE 
          WHEN sa.unlocked_at IS NOT NULL THEN true
          ELSE false
        END as unlocked,
        CASE 
          WHEN sa.progress IS NOT NULL THEN 
            ROUND((sa.progress::decimal / a.requirement_value * 100), 2)
          ELSE 0
        END as progress_percentage
      FROM achievements a
      LEFT JOIN student_achievements sa 
        ON a.id = sa.achievement_id AND sa.student_id = $1
      WHERE a.is_active = true
      ORDER BY a.badge_tier, a.requirement_value
    `;

    const achievementsResult = await pool.query(achievementsQuery, [studentId]);
    
    // Group achievements by category
    const groupedAchievements = {
      milestone: [],
      time: [],
      streak: [],
      focus: []
    };

    achievementsResult.rows.forEach(achievement => {
      if (groupedAchievements[achievement.category]) {
        groupedAchievements[achievement.category].push(achievement);
      }
    });

    // Calculate stats
    const totalAchievements = achievementsResult.rows.length;
    const unlockedAchievements = achievementsResult.rows.filter(a => a.unlocked).length;
    const completionPercentage = totalAchievements > 0 
      ? ((unlockedAchievements / totalAchievements) * 100).toFixed(1)
      : 0;

    res.json({
      achievements: groupedAchievements,
      stats: {
        total: totalAchievements,
        unlocked: unlockedAchievements,
        locked: totalAchievements - unlockedAchievements,
        completion_percentage: parseFloat(completionPercentage)
      }
    });

  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ 
      error: 'Failed to fetch achievements',
      details: error.message 
    });
  }
});

// ============================================
// POST /api/achievements/check - Check and unlock achievements
// ============================================
router.post('/check', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.userId;
    const newlyUnlocked = [];

    // Get student stats
    const studentQuery = `
      SELECT 
        total_sessions,
        total_study_minutes,
        streak_days
      FROM students
      WHERE id = $1
    `;
    const studentResult = await pool.query(studentQuery, [studentId]);
    const student = studentResult.rows[0];

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get all active achievements not yet unlocked by this student
    const unlockedQuery = `
      SELECT a.id, a.requirement_type, a.requirement_value, a.points_reward
      FROM achievements a
      LEFT JOIN student_achievements sa 
        ON a.id = sa.achievement_id AND sa.student_id = $1
      WHERE a.is_active = true AND sa.unlocked_at IS NULL
    `;
    const unlockedResult = await pool.query(unlockedQuery, [studentId]);

    // Check each achievement
    for (const achievement of unlockedResult.rows) {
      let progress = 0;
      let shouldUnlock = false;

      switch (achievement.requirement_type) {
        case 'sessions_count':
          progress = student.total_sessions;
          shouldUnlock = progress >= achievement.requirement_value;
          break;

        case 'total_minutes':
          progress = student.total_study_minutes;
          shouldUnlock = progress >= achievement.requirement_value;
          break;

        case 'streak_days':
          progress = student.streak_days;
          shouldUnlock = progress >= achievement.requirement_value;
          break;

        case 'single_session_minutes':
          // Check if student has any session meeting this duration
          const sessionQuery = `
            SELECT COUNT(*) as count
            FROM study_sessions
            WHERE student_id = $1 
              AND duration_minutes >= $2
              AND status = 'completed'
          `;
          const sessionResult = await pool.query(sessionQuery, [
            studentId,
            achievement.requirement_value
          ]);
          progress = parseInt(sessionResult.rows[0].count);
          shouldUnlock = progress > 0;
          break;
      }

      // Update or insert progress
      if (shouldUnlock) {
        // Unlock the achievement
        await pool.query(`
          INSERT INTO student_achievements (student_id, achievement_id, progress, unlocked_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (student_id, achievement_id) 
          DO UPDATE SET unlocked_at = CURRENT_TIMESTAMP, progress = $3
        `, [studentId, achievement.id, progress]);

        // Award points to student
        await pool.query(`
          UPDATE students
          SET total_points = total_points + $1
          WHERE id = $2
        `, [achievement.points_reward, studentId]);

        newlyUnlocked.push({
          achievement_id: achievement.id,
          points_earned: achievement.points_reward
        });
      } else {
        // Just update progress
        await pool.query(`
          INSERT INTO student_achievements (student_id, achievement_id, progress)
          VALUES ($1, $2, $3)
          ON CONFLICT (student_id, achievement_id) 
          DO UPDATE SET progress = $3
        `, [studentId, achievement.id, progress]);
      }
    }

    res.json({
      message: 'Achievements checked',
      newly_unlocked: newlyUnlocked,
      count: newlyUnlocked.length
    });

  } catch (error) {
    console.error('Error checking achievements:', error);
    res.status(500).json({ 
      error: 'Failed to check achievements',
      details: error.message 
    });
  }
});

// ============================================
// GET /api/achievements/recent - Get recently unlocked achievements
// ============================================
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.userId;

    const recentQuery = `
      SELECT 
        a.id,
        a.name,
        a.description,
        a.icon,
        a.badge_tier,
        a.points_reward,
        sa.unlocked_at
      FROM student_achievements sa
      JOIN achievements a ON sa.achievement_id = a.id
      WHERE sa.student_id = $1 
        AND sa.unlocked_at IS NOT NULL
      ORDER BY sa.unlocked_at DESC
      LIMIT 5
    `;

    const result = await pool.query(recentQuery, [studentId]);

    res.json({
      recent_achievements: result.rows
    });

  } catch (error) {
    console.error('Error fetching recent achievements:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recent achievements',
      details: error.message 
    });
  }
});

module.exports = router;