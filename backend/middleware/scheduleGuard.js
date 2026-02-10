const db = require('../db/connection');

const TIER_CONFIG = {
  'P1-P3': { dailyMinutes: 15, weeklyDays: 4, masteryGate: 65, chaptersDefault: 4 },
  'P4-P6': { dailyMinutes: 25, weeklyDays: 5, masteryGate: 70, chaptersDefault: 4 },
  'S1-S3': { dailyMinutes: 40, weeklyDays: 6, masteryGate: 70, chaptersDefault: 5 },
  'S4-S6': { dailyMinutes: 60, weeklyDays: 6, masteryGate: 75, chaptersDefault: 6 }
};

const checkScheduleLimits = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if today is a rest day
    const restDayCheck = await db.query(`
      SELECT is_rest_day 
      FROM student_schedules 
      WHERE student_id = $1 
      AND day_of_week = EXTRACT(DOW FROM CURRENT_DATE)
    `, [userId]);

    const isRestDay = restDayCheck.rows.length > 0 && restDayCheck.rows[0].is_rest_day;

    // Get student info + today's usage
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
        AND dsl.session_ended_at IS NOT NULL
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
        error: 'ONBOARDING_REQUIRED',
        type: 'ONBOARDING_REQUIRED',
        message: 'Please complete onboarding first by setting your form level.'
      });
    }

    // Check rest day
    if (isRestDay) {
      return res.status(403).json({
        success: false,
        code: 'REST_DAY',
        error: 'REST_DAY',
        type: 'REST_DAY',
        message: 'Today is your scheduled rest day. Take a break and come back tomorrow!'
      });
    }

    const dailyLimit = student.daily_time_limit_minutes || TIER_CONFIG[student.age_tier]?.dailyMinutes || 25;
    const todayUsed = student.today_minutes;
    const remaining = Math.max(0, dailyLimit - todayUsed);

    // Check time limit
    if (remaining <= 0) {
      return res.status(403).json({
        success: false,
        code: 'TIME_LIMIT_REACHED',
        error: 'TIME_LIMIT_REACHED',
        type: 'TIME_LIMIT_REACHED',
        message: `You've used all ${dailyLimit} minutes for today. Come back tomorrow!`,
        remaining: 0,
        remainingMinutes: 0
      });
    }

    req.scheduleInfo = {
      formLevel: student.form_level,
      ageTier: student.age_tier,
      dailyLimit,
      todayUsed,
      remaining,
      tierConfig: TIER_CONFIG[student.age_tier] || TIER_CONFIG['P4-P6'],
      shouldWarnSoon: remaining <= 5
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
        error: 'ONBOARDING_REQUIRED',
        type: 'ONBOARDING_REQUIRED',
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