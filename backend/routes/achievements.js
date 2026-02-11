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
          WHEN a.requirement_value > 0 THEN 
            LEAST(ROUND((COALESCE(sa.progress, 0)::decimal / a.requirement_value * 100), 2), 100)
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
      const category = achievement.category || 'milestone';
      if (groupedAchievements[category]) {
        groupedAchievements[category].push(achievement);
      } else {
        groupedAchievements.milestone.push(achievement);
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
    const studentId = req.student.id;
    const newlyUnlocked = [];

    console.log('\n🎯 ========== CHECKING ACHIEVEMENTS ==========');
    console.log(`👤 Student ID: ${studentId}`);

    // Get student stats
    const studentQuery = `
      SELECT 
        total_sessions,
        total_study_time,
        current_streak
      FROM students
      WHERE id = $1
    `;
    const studentResult = await pool.query(studentQuery, [studentId]);
    const student = studentResult.rows[0];

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    console.log('\n📊 Current Stats:');
    console.log(`   Total Sessions: ${student.total_sessions}`);
    console.log(`   Total Study Time: ${student.total_study_time} minutes`);
    console.log(`   Current Streak: ${student.current_streak} days`);

    // Get all active achievements that are NOT YET UNLOCKED by this student
    const unlockedQuery = `
      SELECT a.id, a.name, a.requirement_type, a.requirement_value, a.points_reward, a.icon, a.description
      FROM achievements a
      LEFT JOIN student_achievements sa 
        ON a.id = sa.achievement_id AND sa.student_id = $1
      WHERE a.is_active = true 
        AND (sa.unlocked_at IS NULL OR sa.id IS NULL)
    `;
    const unlockedResult = await pool.query(unlockedQuery, [studentId]);

    console.log(`\n🔓 Found ${unlockedResult.rows.length} locked achievements to check\n`);

    // Check each achievement
    for (const achievement of unlockedResult.rows) {
      let progress = 0;
      let shouldUnlock = false;

      console.log(`\n🔍 Checking: "${achievement.name}"`);
      console.log(`   Type: ${achievement.requirement_type}`);
      console.log(`   Required: ${achievement.requirement_value}`);

      switch (achievement.requirement_type) {
        case 'sessions_count':
          progress = student.total_sessions || 0;
          shouldUnlock = progress >= achievement.requirement_value;
          console.log(`   Your Progress: ${progress} sessions`);
          break;

        case 'total_minutes':
          progress = student.total_study_time || 0;
          shouldUnlock = progress >= achievement.requirement_value;
          console.log(`   Your Progress: ${progress} minutes`);
          break;

        case 'streak_days':
          progress = student.current_streak || 0;
          shouldUnlock = progress >= achievement.requirement_value;
          console.log(`   Your Progress: ${progress} days`);
          break;

        case 'single_session_minutes':
          // Check if student has any session meeting this duration
          const sessionQuery = `
            SELECT COUNT(*) as count
            FROM study_sessions
            WHERE student_id = $1 
              AND duration >= $2
              AND status = 'completed'
          `;
          const sessionResult = await pool.query(sessionQuery, [
            studentId,
            achievement.requirement_value
          ]);
          progress = parseInt(sessionResult.rows[0].count);
          shouldUnlock = progress > 0;
          console.log(`   Sessions >= ${achievement.requirement_value} min: ${progress}`);
          break;

        default:
          console.log(`   ⚠️ Unknown requirement type: ${achievement.requirement_type}`);
          continue;
      }

      console.log(`   Should Unlock: ${shouldUnlock ? '✅ YES' : '❌ NO'}`);

      // Only unlock if requirement is actually met
      if (shouldUnlock) {
        console.log(`   🎉 UNLOCKING ACHIEVEMENT!`);
        console.log(`   Points Awarded: ${achievement.points_reward}`);
        
        // Upsert: Insert or update the achievement record with unlock time
        await pool.query(`
          INSERT INTO student_achievements (student_id, achievement_id, progress, unlocked_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (student_id, achievement_id) 
          DO UPDATE SET 
            unlocked_at = CURRENT_TIMESTAMP, 
            progress = $3
        `, [studentId, achievement.id, progress]);

        // Award points to student
        await pool.query(`
          UPDATE students
          SET total_points = COALESCE(total_points, 0) + $1
          WHERE id = $2
        `, [achievement.points_reward, studentId]);

        newlyUnlocked.push({
          id: achievement.id,
          name: achievement.name,
          icon: achievement.icon,
          description: achievement.description,
          points_reward: achievement.points_reward
        });
      } else {
        // Just update progress (don't set unlocked_at)
        await pool.query(`
          INSERT INTO student_achievements (student_id, achievement_id, progress, unlocked_at)
          VALUES ($1, $2, $3, NULL)
          ON CONFLICT (student_id, achievement_id) 
          DO UPDATE SET progress = $3
          WHERE student_achievements.unlocked_at IS NULL
        `, [studentId, achievement.id, progress]);
      }
    }

    console.log('\n✨ ========== RESULTS ==========');
    console.log(`Newly Unlocked: ${newlyUnlocked.length}`);
    if (newlyUnlocked.length > 0) {
      newlyUnlocked.forEach(a => {
        console.log(`   🏆 ${a.name} (+${a.points_reward} pts)`);
      });
    }
    console.log('================================\n');

    res.json({
      message: 'Achievements checked',
      newly_unlocked: newlyUnlocked,
      count: newlyUnlocked.length
    });

  } catch (error) {
    console.error('❌ Error checking achievements:', error);
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
    const studentId = req.student.id;

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