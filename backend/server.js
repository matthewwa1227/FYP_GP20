const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// CORS CONFIGURATION - Production Ready
// ============================================
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      // Development
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      
      // Vercel domains (frontend)
      /\.vercel\.app$/,
      
      // Render domains (backend - for webhooks)
      /\.onrender\.com$/,
      
      // Railway domains (legacy support)
      /\.railway\.app$/,
      /\.up\.railway\.app$/,
      
      // Fly.io domains (alternative)
      /\.fly\.dev$/,
      
      // Production frontend (set via env var)
      process.env.FRONTEND_URL,
      
      // Custom domain (if configured)
      process.env.CUSTOM_DOMAIN,
    ].filter(Boolean); // Remove undefined/null
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Import database connection (after ipv4first + dotenv)
const db = require('./db/connection');

// Test database connection on startup
(async () => {
  console.log('🔍 Testing database connection...');
  const connected = await db.testConnection();
  if (!connected) {
    console.error(
      '⚠️ Server started but database connection failed. Check your DATABASE_URL in .env'
    );
  }
})();

// ============================================
// ROUTES - Organized by feature
// ============================================

// Authentication
app.use('/api/auth', require('./routes/auth'));

// Study Sessions
app.use('/api/sessions', require('./routes/sessions'));

// Student Features
app.use('/api/student', require('./routes/student'));

// Achievements System
app.use('/api/achievements', require('./routes/achievements'));

// Leaderboard
app.use('/api/leaderboard', require('./routes/leaderboard'));

// Dashboard
app.use('/api/dashboard', require('./routes/dashboard'));

// Family Connections
app.use('/api/family', require('./routes/family'));

// AI Features
app.use('/api/ai', require('./routes/ai'));

// Tasks System
app.use('/api/tasks', require('./routes/tasks'));

app.use('/api/ai/story', require('./routes/aiStory'));

// Story Quest RPG Routes
app.use('/api/storyquest', require('./routes/storyquest'));

app.use('/api/schedule', require('./routes/schedule'));

// Revision Mode (Document-based learning)
app.use('/api/revision', require('./routes/revision'));

// ============================================
// NEW FEATURES v2.0
// ============================================

// Progress Monitoring & Goals
app.use('/api/progress', require('./routes/progress'));

// Parent-Teacher Rewards Collaboration
app.use('/api/rewards', require('./routes/rewards'));

// Teacher Module (Classes, Analytics, Session Verification)
app.use('/api/teacher', require('./routes/teacher'));

// Social Features (Study Groups, Friends, Challenges)
app.use('/api/social', require('./routes/social'));

// Schedule Optimizer
app.use('/api/schedule-optimizer', require('./routes/scheduleOptimizer'));

// Exercise Generator (Printable Worksheets)
app.use('/api/exercises', require('./routes/exercises'));

// ============================================
// NEW: ROOT API ENDPOINT (FIXES YOUR /api ISSUE)
// ============================================
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'StudyQuest API v1.0.0 is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/register, /api/auth/login',
      sessions: '/api/sessions/active, /api/sessions/history',
      tasks: '/api/tasks',
      student: '/api/student/profile',
      achievements: '/api/achievements',
      leaderboard: '/api/leaderboard/global'
    },
    docs: 'Check console logs for full endpoint list'
  });
});

// ============================================
// HEALTH & TEST ENDPOINTS
// ============================================

// Health check with database status
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let dbMessage = '';

  try {
    const result = await db.query('SELECT NOW() as current_time, version() as version');
    dbStatus = 'connected';
    dbMessage = `Connected to PostgreSQL at ${result.rows[0].current_time}`;
  } catch (error) {
    dbStatus = 'error';
    dbMessage = error.message;
  }

  res.json({
    status: 'Server is running!',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      message: dbMessage,
    },
  });
});

// Database test endpoint
app.get('/api/db/test', async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) as student_count FROM students');
    const achievements = await db.query('SELECT COUNT(*) as achievement_count FROM achievements');
    const sessions = await db.query('SELECT COUNT(*) as session_count FROM study_sessions');
    const tasks = await db.query('SELECT COUNT(*) as task_count FROM tasks');

    res.json({
      success: true,
      message: 'Database connection successful!',
      data: {
        students: result.rows[0].student_count,
        achievements: achievements.rows[0].achievement_count,
        sessions: sessions.rows[0].session_count,
        tasks: tasks.rows[0].task_count,
        tables: ['students', 'study_sessions', 'achievements', 'student_achievements', 'daily_goals', 'tasks'],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
    });
  }
});

// ============================================
// ERROR HANDLERS
// ============================================

// 404 handler - AFTER all your routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    available: [
      '/api/health',
      '/api/db/test',
      '/api/auth/register',
      '/api/auth/login'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 StudyQuest API Server`);
  console.log(`${'='.repeat(50)}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ http://localhost:${PORT}/api`);  // ← NOW THIS WORKS!

  console.log(`${'='.repeat(50)}\n`);
});
