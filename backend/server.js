const express = require('express');
const cors = require('cors');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Import database connection
const db = require('./db/connection');
const sessionsRouter = require('./routes/sessions');
app.use('/api/sessions', sessionsRouter);

// Test database connection on startup
(async () => {
  console.log('🔍 Testing database connection...');
  const connected = await db.testConnection();
  if (!connected) {
    console.error('⚠️  Server started but database connection failed. Check your DATABASE_URL in .env');
  }
})();

// Routes
app.use('/api/auth', require('./routes/auth'));
// Import session routes (add this with other route imports)
const sessionRoutes = require('./routes/sessions');
// Register routes (add this with other route registrations)
app.use('/api/sessions', sessionRoutes);
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
    environment: process.env.NODE_ENV,
    database: {
      status: dbStatus,
      message: dbMessage
    }
  });
});

// Database test endpoint
app.get('/api/db/test', async (req, res) => {
  try {
    // Test basic query
    const result = await db.query('SELECT COUNT(*) as student_count FROM students');
    const achievements = await db.query('SELECT COUNT(*) as achievement_count FROM achievements');
    
    res.json({
      success: true,
      message: 'Database connection successful!',
      data: {
        students: result.rows[0].student_count,
        achievements: achievements.rows[0].achievement_count,
        tables: ['students', 'study_sessions', 'achievements', 'student_achievements', 'daily_goals']
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n📍 Available endpoints:`);
  console.log(`   - GET  http://localhost:${PORT}/api/health`);
  console.log(`   - GET  http://localhost:${PORT}/api/db/test`);
  console.log(`   - GET  http://localhost:${PORT}/api/auth/health`);
  console.log(`   - POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   - POST http://localhost:${PORT}/api/auth/login`);
});