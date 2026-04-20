// ============================================
// StudyQuest API Server
// FYP GP20 - Main Entry Point
// MISSION 62: Production-ready with graceful shutdown & monitoring
// ============================================

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// DATABASE CONNECTION (import early)
// ============================================
const db = require('./db/connection');
const { generalLimiter, userLimiter, healthCheck } = require('./middleware/concurrencyGuard');

// ============================================
// CORS CONFIGURATION - Production Ready
// ============================================
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'https://frontend-beta-ten-26.vercel.app', // Your specific Vercel URL
      /\.vercel\.app$/,
      /\.onrender\.com$/,
      /\.railway\.app$/,
      /\.up\.railway\.app$/,
      /\.fly\.dev$/,
      process.env.FRONTEND_URL,
      process.env.CUSTOM_DOMAIN,
    ].filter(Boolean);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      // TEMPORARY: Allow all origins for debugging
      // callback(new Error(`Origin ${origin} not allowed by CORS`));
      console.log(`⚠️ TEMP: Allowing blocked origin for debugging: ${origin}`);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Device-ID'],
  exposedHeaders: ['Content-Range', 'X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// RATE LIMITING (MISSION 62)
// ============================================
// Apply general rate limit to all API routes
app.use('/api/', generalLimiter);

// Apply stricter user limit to authenticated routes
app.use('/api/sessions', userLimiter);
app.use('/api/achievements', userLimiter);
app.use('/api/tasks', userLimiter);
app.use('/api/student', userLimiter);


app.use((req, res, next) => {
  req.setTimeout(100000, () => {
    if (res.headersSent) {
      console.warn(`⏱️ Request timeout (headers already sent): ${req.method} ${req.path}`);
      return;
    }
    console.error(`⏱️ Request timeout: ${req.method} ${req.path}`);
    res.status(503).json({
      success: false,
      message: 'Request timeout. Please try again.',
      code: 'REQUEST_TIMEOUT'
    });
  });
  next();
});


// Basic health check (no rate limit)
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await db.query('SELECT NOW() as time');
    const poolMetrics = db.getPoolMetrics();
    
    // Determine health status
    let status = 'healthy';
    if (poolMetrics.utilizationPercent > 90) status = 'critical';
    else if (poolMetrics.utilizationPercent > 70) status = 'warning';
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: true,
        responseTime: dbResult.rows[0].time,
        pool: poolMetrics,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      }
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: err.message,
    });
  }
});

// Detailed database health (for monitoring)
app.get('/api/health/db', async (req, res) => {
  try {
    const poolMetrics = db.getPoolMetrics();
    const maxConnections = await db.query('SHOW max_connections');
    const currentConnections = await db.query(
      `SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`
    );
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      pool: poolMetrics,
      database: {
        maxConnections: parseInt(maxConnections.rows[0].max_connections),
        currentConnections: parseInt(currentConnections.rows[0].count),
        utilizationPercent: Math.round(
          (parseInt(currentConnections.rows[0].count) / parseInt(maxConnections.rows[0].max_connections)) * 100
        ),
      }
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: err.message,
    });
  }
});

// ============================================
// DATABASE TEST ON STARTUP
// ============================================
(async () => {
  console.log('🔍 Testing database connection...');
  const connected = await db.testConnection();
  if (!connected) {
    console.error('⚠️ Database connection failed. Server will continue but functionality may be limited.');
  }
})();

// ============================================
// ROUTES - Organized by feature
// ============================================

app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/student', require('./routes/student'));
app.use('/api/achievements', require('./routes/achievements'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/family', require('./routes/family'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/ai/story', require('./routes/aiStory'));
app.use('/api/storyquest', require('./routes/storyquest'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/revision', require('./routes/revision'));
app.use('/api/archive', require('./routes/archive'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/social', require('./routes/social'));
app.use('/api/schedule-optimizer', require('./routes/scheduleOptimizer'));
app.use('/api/exercises', require('./routes/exercises'));
app.use('/api/study', require('./routes/studyquest-rebuild')); // StudyQuest Rebuild Routes (legacy)

// ============================================
// STUDYQUEST REBUILD - Phase 1: Data Layer
// ============================================
app.use('/api/projects', require('./routes/projects'));
app.use('/api/chapters', require('./routes/chapters'));
app.use('/api/attempts', require('./routes/attempts'));
app.use('/api/boss-battles', require('./routes/bossBattles'));
app.use('/api/artifacts', require('./routes/artifacts'));

// ============================================
// ROOT API ENDPOINT
// ============================================
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'StudyQuest API v1.0.0 is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      healthDb: '/api/health/db',
      auth: '/api/auth/register, /api/auth/login',
      sessions: '/api/sessions/active, /api/sessions/history',
      tasks: '/api/tasks',
      student: '/api/student/profile',
      achievements: '/api/achievements',
      leaderboard: '/api/leaderboard/global'
    },
    mission: 'MISSION 62: Concurrent Access Fixed'
  });
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

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  
  // Handle specific error types
  if (err.message?.includes('timeout')) {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please retry.',
      code: 'TIMEOUT'
    });
  }
  
  if (err.message?.includes('too many connections')) {
    return res.status(503).json({
      success: false,
      message: 'Database overloaded. Please retry in a moment.',
      code: 'DB_OVERLOAD'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============================================
// SERVER STARTUP
// ============================================

const server = app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 StudyQuest API Server`);
  console.log(`🎯 MISSION 62: Concurrent Access Fixed`);
  console.log(`${'='.repeat(50)}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Pool Size: ${db.POOL_CONFIG.max} connections`);
  console.log(`✅ http://localhost:${PORT}/api`);
  console.log(`${'='.repeat(50)}\n`);
});

// ============================================
// GRACEFUL SHUTDOWN (MISSION 62)
// ============================================

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('🛑 HTTP server closed');
    
    // Close database pool
    await db.closePool(10000);
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 15 seconds
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 15000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
