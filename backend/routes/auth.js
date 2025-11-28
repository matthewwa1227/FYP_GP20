const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    message: 'Auth routes are working!',
    timestamp: new Date()
  });
});

// Temporary route to inspect database schema
router.get('/inspect-schema', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'students'
      ORDER BY ordinal_position;
    `);
    
    res.json({
      success: true,
      table: 'students',
      columns: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// REGISTER - Create new user account
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // ===== STEP 1: Validate Input =====
    // Check if all fields are provided
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email, and password'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password strength (min 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Validate username (alphanumeric, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-20 characters (letters, numbers, underscore only)'
      });
    }

    // ===== STEP 2: Check for Duplicates =====
    // Check if email already exists
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

    // Check if username already exists
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

    // ===== STEP 3: Hash Password =====
    // Never store plain text passwords!
    // bcrypt.hash(password, saltRounds)
    // saltRounds=10 means 2^10 iterations (secure but not too slow)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ===== STEP 4: Create User in Database =====
    const result = await db.query(
      `INSERT INTO students (username, email, password_hash, level, xp, total_study_time, current_streak, longest_streak)
       VALUES ($1, $2, $3, 1, 0, 0, 0, 0)
       RETURNING id, username, email, level, xp, total_study_time, current_streak, longest_streak, created_at`,
      [username, email.toLowerCase(), hashedPassword]
    );

    const newStudent = result.rows[0];

    // ===== STEP 5: Generate JWT Token =====
    // This token proves the user is authenticated
    const token = jwt.sign(
      { 
        studentId: newStudent.id,
        email: newStudent.email,
        username: newStudent.username
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // ===== STEP 6: Send Response =====
    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      data: {
        student: {
          id: newStudent.id,
          username: newStudent.username,
          email: newStudent.email,
          level: newStudent.level,
          xp: newStudent.xp,
          total_study_time: newStudent.total_study_time,
          current_streak: newStudent.current_streak,
          longest_streak: newStudent.longest_streak,
          created_at: newStudent.created_at
        },
        token: token
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
// LOGIN - Authenticate existing user
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ===== STEP 1: Validate Input =====
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // ===== STEP 2: Find User by Email =====
    const result = await db.query(
      `SELECT id, username, email, password_hash, level, xp, total_study_time, 
              current_streak, longest_streak, created_at
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

    const student = result.rows[0];

    // ===== STEP 3: Verify Password =====
    // bcrypt.compare(plainPassword, hashedPassword)
    // This safely compares without exposing the hash
    const isPasswordValid = await bcrypt.compare(password, student.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // ===== STEP 4: Generate JWT Token =====
    const token = jwt.sign(
      { 
        studentId: student.id,
        email: student.email,
        username: student.username
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // ===== STEP 5: Send Response =====
    // Don't send password_hash back!
    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        student: {
          id: student.id,
          username: student.username,
          email: student.email,
          level: student.level,
          xp: student.xp,
          total_study_time: student.total_study_time,
          current_streak: student.current_streak,
          longest_streak: student.longest_streak,
          created_at: student.created_at
        },
        token: token
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

const { authenticateToken } = require('../middleware/auth');

// Protected route - requires valid token
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // req.student is available because of authenticateToken middleware
    const result = await db.query(
      `SELECT id, username, email, full_name, avatar_url, bio,
              total_points, current_level, experience_points, 
              streak_days, total_study_minutes, total_sessions,
              created_at, last_login
       FROM students 
       WHERE id = $1`,
      [req.student.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile'
    });
  }
});

module.exports = router;