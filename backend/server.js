const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
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
  console.log(`\n📚 Available Endpoints:`);
  console.log(`\n   Health & Database:`);
  console.log(`   - GET  /api/health`);
  console.log(`   - GET  /api/db/test`);
  console.log(`\n   Authentication:`);
  console.log(`   - POST /api/auth/register`);
  console.log(`   - POST /api/auth/login`);
  console.log(`   - GET  /api/auth/health`);
  console.log(`\n   Study Sessions:`);
  console.log(`   - POST /api/sessions/start`);
  console.log(`   - POST /api/sessions/:id/end`);
  console.log(`   - GET  /api/sessions/active`);
  console.log(`   - GET  /api/sessions/history`);
  console.log(`\n   Tasks:`);
  console.log(`   - GET  /api/tasks`);
  console.log(`   - POST /api/tasks`);
  console.log(`   - PUT  /api/tasks/:id`);
  console.log(`   - DELETE /api/tasks/:id`);
  console.log(`   - PATCH /api/tasks/:id/toggle`);
  console.log(`\n   Achievements:`);
  console.log(`   - GET  /api/achievements`);
  console.log(`   - GET  /api/achievements/student`);
  console.log(`   - POST /api/achievements/check`);
  console.log(`\n   Leaderboard:`);
  console.log(`   - GET  /api/leaderboard/global`);
  console.log(`   - GET  /api/leaderboard/my-rank`);
  console.log(`\n   Dashboard:`);
  console.log(`   - GET  /api/dashboard`);
  console.log(`   - GET  /api/dashboard/stats/weekly`);
  console.log(`${'='.repeat(50)}\n`);
});