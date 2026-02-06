// middleware/scheduleGuard.js

const db = require('../db/connection');

// Tier config (centralized)
const TIER_CONFIG = {
  'P1-P3': { dailyMinutes: 15, weeklyDays: 4, masteryGate: 65, chaptersDefault: 4 },
  'P4-P6': { dailyMinutes: 25, weeklyDays: 5, masteryGate: 70, chaptersDefault: 4 },
  'S1-S3': { dailyMinutes: 40, weeklyDays: 6, masteryGate: 70, chaptersDefault: 5 },
  'S4-S6': { dailyMinutes: 60, weeklyDays: 6, masteryGate: 75, chaptersDefault: 6 }
};

/**
 * Checks that the student:
 *  1. Has completed onboarding (form_level set)
 *  2. Has not exceeded their daily time limit
 * 
 * Attaches req.scheduleInfo with time/tier data for downstream use.
 */
const checkScheduleLimits = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Single query: get student tier info + today's total usage
    const result = await db.query(`
      SELECT 
        s.form_level,
        s.age_tier,
        s.daily_time_limit_minutes,
        s.onboarding_completed,
        COALESCE(SUM(dsl.actual_minutes), 0)::int AS today_minutes
      FROM students s
      LEFT JOIN daily_session_log dsl 
        ON dsl.student_id = s.id 
        AND dsl.session_date = CURRENT_DATE
        AND dsl.is_rest_day = FALSE
      WHERE s.id = $1
      GROUP BY s.id
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const student = result.rows[0];

    // Check onboarding
    if (!student.onboarding_completed || !student.form_level) {
      return res.status(403).json({
        success: false,
        code: 'ONBOARDING_REQUIRED',
        message: 'Please complete onboarding first by setting your form level.',
        action: 'PATCH /api/auth/onboarding'
      });
    }

    const dailyLimit = student.daily_time_limit_minutes;
    const todayUsed = student.today_minutes;
    const remaining = Math.max(0, dailyLimit - todayUsed);

    // Check time limit
    if (remaining <= 0) {
      return res.status(403).json({
        success: false,
        code: 'TIME_LIMIT_REACHED',
        message: `You've used all ${dailyLimit} minutes for today. Come back tomorrow!`,
        data: {
          dailyLimit,
          todayUsed,
          remaining: 0
        }
      });
    }

    // Attach schedule info for downstream routes
    req.scheduleInfo = {
      formLevel: student.form_level,
      ageTier: student.age_tier,
      dailyLimit,
      todayUsed,
      remaining,
      tierConfig: TIER_CONFIG[student.age_tier] || TIER_CONFIG['P4-P6'],
      shouldWarnSoon: remaining <= 5  // 5 minutes warning
    };

    next();

  } catch (error) {
    console.error('❌ Schedule guard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking schedule limits'
    });
  }
};

/**
 * Lighter version: just checks onboarding, no time limit enforcement.
 * Use for read-only schedule routes.
 */
const requireOnboarding = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT form_level, age_tier, onboarding_completed FROM students WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const student = result.rows[0];

    if (!student.onboarding_completed || !student.form_level) {
      return res.status(403).json({
        success: false,
        code: 'ONBOARDING_REQUIRED',
        message: 'Please set your form level first.'
      });
    }

    req.tierInfo = {
      formLevel: student.form_level,
      ageTier: student.age_tier,
      tierConfig: TIER_CONFIG[student.age_tier] || TIER_CONFIG['P4-P6']
    };

    next();

  } catch (error) {
    console.error('❌ Onboarding check error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { checkScheduleLimits, requireOnboarding, TIER_CONFIG };