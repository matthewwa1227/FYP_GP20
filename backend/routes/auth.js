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
      SELECT column_name, data_type, is_nullable, column_default
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
    const { username, email, password, role = 'student', fullName } = req.body;

    // ===== STEP 1: Validate Input =====
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

    // Validate role
    const validRoles = ['student', 'parent'];
    const userRole = validRoles.includes(role) ? role : 'student';

    // ===== STEP 2: Check for Duplicates =====
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

    // ===== STEP 3: Hash Password =====
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ===== STEP 4: Create User in Database =====
    // Different default values for students vs parents
    const result = await db.query(
      `INSERT INTO students (
        username, 
        email, 
        password_hash, 
        full_name,
        role,
        level, 
        xp, 
        total_study_time, 
        current_streak, 
        longest_streak
      )
       VALUES ($1, $2, $3, $4, $5, 1, 0, 0, 0, 0)
       RETURNING id, username, email, full_name, role, level, xp, 
                 total_study_time, current_streak, longest_streak, created_at`,
      [username, email.toLowerCase(), hashedPassword, fullName || null, userRole]
    );

    const newUser = result.rows[0];

    // ===== STEP 5: Generate JWT Token =====
    const token = jwt.sign(
      { 
        studentId: newUser.id,
        id: newUser.id,  // Include both for compatibility
        email: newUser.email,
        username: newUser.username,
        role: newUser.role  // IMPORTANT: Include role in token
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
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.full_name,
          role: newUser.role,
          level: newUser.level,
          xp: newUser.xp,
          total_study_time: newUser.total_study_time,
          current_streak: newUser.current_streak,
          longest_streak: newUser.longest_streak,
          created_at: newUser.created_at
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
      `SELECT id, username, email, password_hash, full_name, role,
              level, xp, total_study_time, current_streak, longest_streak, 
              created_at
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

    // ===== STEP 3: Verify Password =====
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // ===== STEP 4: Update last login =====
    await db.query(
      'UPDATE students SET last_login = NOW() WHERE id = $1',
      [user.id]
    ).catch(err => console.log('Could not update last_login:', err.message));

    // ===== STEP 5: Generate JWT Token =====
    const token = jwt.sign(
      { 
        studentId: user.id,
        id: user.id,  // Include both for compatibility
        email: user.email,
        username: user.username,
        role: user.role || 'student'  // IMPORTANT: Include role, default to student
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // ===== STEP 6: Send Response =====
    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        student: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role || 'student',
          level: user.level,
          xp: user.xp,
          total_study_time: user.total_study_time,
          current_streak: user.current_streak,
          longest_streak: user.longest_streak,
          created_at: user.created_at
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

// ============================================
// REGISTER PARENT - Convenience endpoint
// ============================================
router.post('/register-parent', async (req, res) => {
  // Set role to parent and forward to regular register
  req.body.role = 'parent';
  
  // Call the register logic directly
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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO students (
        username, email, password_hash, full_name, role,
        level, xp, total_study_time, current_streak, longest_streak
      )
       VALUES ($1, $2, $3, $4, 'parent', 1, 0, 0, 0, 0)
       RETURNING id, username, email, full_name, role, created_at`,
      [username, email.toLowerCase(), hashedPassword, fullName || null]
    );

    const newParent = result.rows[0];

    const token = jwt.sign(
      { 
        studentId: newParent.id,
        id: newParent.id,
        email: newParent.email,
        username: newParent.username,
        role: 'parent'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Parent account registered successfully!',
      data: {
        user: {
          id: newParent.id,
          username: newParent.username,
          email: newParent.email,
          fullName: newParent.full_name,
          role: 'parent',
          created_at: newParent.created_at
        },
        token: token
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

const { authenticateToken } = require('../middleware/auth');

// Protected route - requires valid token
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, full_name, avatar_url, bio, role,
              total_points, current_level, experience_points, 
              streak_days, total_study_minutes, total_sessions,
              created_at, last_login
       FROM students 
       WHERE id = $1`,
      [req.user.id]  // Changed from req.student.id to req.user.id
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

// Get current user info from token
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, full_name, role, level, xp,
              current_streak, created_at
       FROM students 
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
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
        level: user.level,
        xp: user.xp,
        currentStreak: user.current_streak
      }
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

router.get('/inspect-sessions-schema', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'study_sessions'
      ORDER BY ordinal_position;
    `);
    
    res.json({
      success: true,
      table: 'study_sessions',
      columns: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;