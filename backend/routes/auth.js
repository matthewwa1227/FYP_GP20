// C:\Users\eeapp\OneDrive\Desktop\FYP_GP20\backend\routes\auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// CONSTANTS
// ============================================
const VALID_FORM_LEVELS = [
  'P1','P2','P3','P4','P5','P6',
  'S1','S2','S3','S4','S5','S6'
];

const VALID_ROLES = ['student', 'parent'];

// Helper: generate JWT with tier info
function generateToken(user) {
  return jwt.sign(
    {
      studentId: user.id,
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role || 'student',
      formLevel: user.form_level || null,
      ageTier: user.age_tier || null
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

// Helper: format user response
function formatUserResponse(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    role: user.role || 'student',
    formLevel: user.form_level || null,
    ageTier: user.age_tier || null,
    dailyTimeLimitMinutes: user.daily_time_limit_minutes || null,
    weeklyScheduleDays: user.weekly_schedule_days || null,
    onboardingCompleted: user.onboarding_completed || false,
    level: user.level,
    xp: user.xp,
    totalStudyTime: user.total_study_time,
    currentStreak: user.current_streak,
    longestStreak: user.longest_streak,
    createdAt: user.created_at
  };
}

// ============================================
// HEALTH CHECK
// ============================================
router.get('/health', (req, res) => {
  res.json({
    message: 'Auth routes are working!',
    timestamp: new Date()
  });
});

// ============================================
// INSPECT SCHEMA (dev only)
// ============================================
router.get('/inspect-schema', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'students'
      ORDER BY ordinal_position;
    `);
    res.json({ success: true, table: 'students', columns: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// REGISTER - Student or Parent
// ============================================
router.post('/register', async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      role = 'student',
      fullName,
      formLevel  // NEW: optional at registration, required before using schedule
    } = req.body;

    // --- Validate required fields ---
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email, and password'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-20 characters (letters, numbers, underscore only)'
      });
    }

    // --- Validate role ---
    const userRole = VALID_ROLES.includes(role) ? role : 'student';

    // --- Validate formLevel (if provided) ---
    let validFormLevel = null;
    if (formLevel) {
      const upperLevel = formLevel.toUpperCase();
      if (!VALID_FORM_LEVELS.includes(upperLevel)) {
        return res.status(400).json({
          success: false,
          message: `Invalid form level. Must be one of: ${VALID_FORM_LEVELS.join(', ')}`
        });
      }
      validFormLevel = upperLevel;
    }

    // --- Check duplicates ---
    const emailCheck = await db.query(
      'SELECT id FROM students WHERE email = $1',
      [email.toLowerCase()]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    const usernameCheck = await db.query(
      'SELECT id FROM students WHERE username = $1',
      [username]
    );
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken'
      });
    }

    // --- Hash password ---
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // --- Insert user ---
    // The DB trigger auto-computes age_tier, daily_time_limit, weekly_schedule_days
    const result = await db.query(
      `INSERT INTO students (
        username, email, password_hash, full_name, role,
        form_level,
        level, xp, total_study_time, current_streak, longest_streak
      )
       VALUES ($1, $2, $3, $4, $5, $6, 1, 0, 0, 0, 0)
       RETURNING id, username, email, full_name, role,
                 form_level, age_tier, daily_time_limit_minutes,
                 weekly_schedule_days, onboarding_completed,
                 level, xp, total_study_time, current_streak,
                 longest_streak, created_at`,
      [username, email.toLowerCase(), hashedPassword, fullName || null, userRole, validFormLevel]
    );

    const newUser = result.rows[0];
    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      data: {
        student: formatUserResponse(newUser),
        token
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// REGISTER PARENT - Convenience endpoint
// ============================================
router.post('/register-parent', async (req, res) => {
  req.body.role = 'parent';
  // Parents don't have a form_level
  req.body.formLevel = null;

  // Forward to the register handler above by re-dispatching
  // (Or just inline the logic — cleaner to call the same handler)
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email, and password'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-20 characters (letters, numbers, underscore only)'
      });
    }

    const emailCheck = await db.query(
      'SELECT id FROM students WHERE email = $1',
      [email.toLowerCase()]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const usernameCheck = await db.query(
      'SELECT id FROM students WHERE username = $1',
      [username]
    );
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO students (
        username, email, password_hash, full_name, role,
        form_level, onboarding_completed,
        level, xp, total_study_time, current_streak, longest_streak
      )
       VALUES ($1, $2, $3, $4, 'parent', NULL, TRUE, 1, 0, 0, 0, 0)
       RETURNING id, username, email, full_name, role,
                 form_level, age_tier, onboarding_completed, created_at`,
      [username, email.toLowerCase(), hashedPassword, fullName || null]
    );

    const newParent = result.rows[0];
    const token = generateToken(newParent);

    res.status(201).json({
      success: true,
      message: 'Parent account registered successfully!',
      data: {
        user: formatUserResponse(newParent),
        token
      }
    });

  } catch (error) {
    console.error('❌ Parent registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// LOGIN
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const result = await db.query(
      `SELECT id, username, email, password_hash, full_name, role,
              form_level, age_tier, daily_time_limit_minutes,
              weekly_schedule_days, onboarding_completed,
              level, xp, total_study_time, current_streak,
              longest_streak, created_at
       FROM students
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await db.query(
      'UPDATE students SET last_login = NOW() WHERE id = $1',
      [user.id]
    ).catch(err => console.log('Could not update last_login:', err.message));

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        student: formatUserResponse(user),
        token,
        // IMPORTANT: Frontend uses this to decide if onboarding is needed
        requiresOnboarding: !user.onboarding_completed && user.role === 'student'
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// ONBOARDING - Set form level for existing users
// ============================================
router.patch('/onboarding', authenticateToken, async (req, res) => {
  try {
    const { formLevel } = req.body;
    const userId = req.user.id;

    if (!formLevel) {
      return res.status(400).json({
        success: false,
        message: 'formLevel is required'
      });
    }

    const upperLevel = formLevel.toUpperCase();
    if (!VALID_FORM_LEVELS.includes(upperLevel)) {
      return res.status(400).json({
        success: false,
        message: `Invalid form level. Must be one of: ${VALID_FORM_LEVELS.join(', ')}`
      });
    }

    // Update form_level — trigger auto-fills age_tier, time limits, etc.
    const result = await db.query(
      `UPDATE students
       SET form_level = $1
       WHERE id = $2
       RETURNING id, username, email, full_name, role,
                 form_level, age_tier, daily_time_limit_minutes,
                 weekly_schedule_days, onboarding_completed,
                 level, xp, total_study_time, current_streak,
                 longest_streak, created_at`,
      [upperLevel, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updatedUser = result.rows[0];

    // Generate fresh token with new tier info
    const token = generateToken(updatedUser);

    res.json({
      success: true,
      message: `Form level set to ${upperLevel}. Welcome to tier ${updatedUser.age_tier}!`,
      data: {
        student: formatUserResponse(updatedUser),
        token,
        tierConfig: {
          ageTier: updatedUser.age_tier,
          dailyMinutes: updatedUser.daily_time_limit_minutes,
          weeklyDays: updatedUser.weekly_schedule_days,
          masteryGate: 70
        }
      }
    });

  } catch (error) {
    console.error('❌ Onboarding error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during onboarding',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// GET PROFILE
// ============================================
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, full_name, avatar_url, bio, role,
              form_level, age_tier, daily_time_limit_minutes,
              weekly_schedule_days, onboarding_completed, preferred_language,
              total_points, current_level, experience_points,
              streak_days, total_study_minutes, total_sessions,
              created_at, last_login
       FROM students
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});

// ============================================
// GET CURRENT USER (lightweight)
// ============================================
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, full_name, role,
              form_level, age_tier, daily_time_limit_minutes,
              weekly_schedule_days, onboarding_completed,
              level, xp, current_streak, created_at
       FROM students
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role || 'student',
        formLevel: user.form_level,
        ageTier: user.age_tier,
        dailyTimeLimitMinutes: user.daily_time_limit_minutes,
        weeklyScheduleDays: user.weekly_schedule_days,
        onboardingCompleted: user.onboarding_completed,
        level: user.level,
        xp: user.xp,
        currentStreak: user.current_streak
      }
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// DEV INSPECT
// ============================================
router.get('/inspect-sessions-schema', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'study_sessions'
      ORDER BY ordinal_position;
    `);
    res.json({ success: true, table: 'study_sessions', columns: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;