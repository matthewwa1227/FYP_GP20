// connection.js
// Supabase Postgres connection helper with pooling, retries, and monitoring
// MISSION 62: Fixed for concurrent access & connection pooling

const { Pool } = require('pg');

// ============================================
// CONFIGURATION
// ============================================
const POOL_CONFIG = {
  // Connection limits per Render instance
  max: parseInt(process.env.DB_POOL_MAX) || 10,
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  
  // Timeouts (milliseconds)
  connectionTimeoutMillis: 10000,  // 10s to establish connection
  idleTimeoutMillis: 30000,        // 30s before closing idle connections
  acquireTimeoutMillis: 15000,     // 15s to acquire connection from pool
  statementTimeout: 30000,         // 30s per query (server-side)
  
  // Retry configuration
  retryAttempts: 3,
  retryDelay: 100, // Initial retry delay (ms), doubles each attempt
};

// Deadlock error codes to retry
const RETRY_ERROR_CODES = new Set([
  '40001', // deadlock_detected
  '40P01', // deadlock_detected (alternative)
  '55P03', // lock_not_available
  '57014', // query_canceled (statement timeout)
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
]);

// ============================================
// UTILITIES
// ============================================
const withTimeout = (promise, ms, label = 'operation') => {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
};

// ============================================
// POOL SETUP
// ============================================
const DATABASE_URL = requireEnv('DATABASE_URL');

// Print safe target (no password)
let safeTarget = '(invalid DATABASE_URL)';
try {
  const u = new URL(DATABASE_URL);
  safeTarget = `${u.hostname}:${u.port || '5432'}${u.pathname}`;
} catch (_) {}
console.log(`🧭 Postgres target: ${safeTarget}`);
console.log(`📊 Pool config: max=${POOL_CONFIG.max}, min=${POOL_CONFIG.min}`);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: POOL_CONFIG.max,
  min: POOL_CONFIG.min,
  connectionTimeoutMillis: POOL_CONFIG.connectionTimeoutMillis,
  idleTimeoutMillis: POOL_CONFIG.idleTimeoutMillis,
  acquireTimeoutMillis: POOL_CONFIG.acquireTimeoutMillis,
});

// ============================================
// POOL EVENT MONITORING
// ============================================
pool.on('connect', () => {
  console.log('✅ New client connected to pool');
});

pool.on('acquire', () => {
  // Silent - too noisy for production
});

pool.on('remove', () => {
  console.log('🔄 Client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err.message);
});

// ============================================
// POOL METRICS
// ============================================
const getPoolMetrics = () => ({
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount,
  maxConnections: POOL_CONFIG.max,
  utilizationPercent: Math.round((pool.totalCount - pool.idleCount) / POOL_CONFIG.max * 100),
});

// ============================================
// QUERY WITH RETRY LOGIC
// ============================================
const query = async (text, params, options = {}) => {
  const { retries = POOL_CONFIG.retryAttempts } = options;
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      
      // Log slow queries (> 1s)
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`⚠️ Slow query (${duration}ms):`, text.substring(0, 100));
      }
      
      return res;
    } catch (err) {
      lastError = err;
      const duration = Date.now() - start;
      
      // Check if error is retryable
      const shouldRetry = attempt < retries && (
        RETRY_ERROR_CODES.has(err.code) ||
        err.message?.includes('deadlock') ||
        err.message?.includes('connection') ||
        err.message?.includes('timeout')
      );
      
      if (shouldRetry) {
        const delay = POOL_CONFIG.retryDelay * Math.pow(2, attempt);
        console.warn(`🔄 Query failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`, err.code || err.message);
        await sleep(delay);
        continue;
      }
      
      // Log final error
      console.error('❌ Query failed:', {
        ms: duration,
        code: err.code,
        message: err.message?.substring(0, 200),
        sql: text.substring(0, 200),
      });
      throw err;
    }
  }
  
  throw lastError;
};

// ============================================
// TRANSACTION WITH RETRY
// ============================================
const withTransaction = async (callback, options = {}) => {
  const { retries = POOL_CONFIG.retryAttempts, isolationLevel = 'READ COMMITTED' } = options;
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const client = await pool.connect();
    
    try {
      // Set isolation level and begin
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      await client.query('BEGIN');
      
      // Execute callback
      const result = await callback(client);
      
      // Commit
      await client.query('COMMIT');
      return result;
      
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      lastError = err;
      
      // Check if error is retryable
      const shouldRetry = attempt < retries && (
        RETRY_ERROR_CODES.has(err.code) ||
        err.message?.includes('deadlock')
      );
      
      if (shouldRetry) {
        const delay = POOL_CONFIG.retryDelay * Math.pow(2, attempt);
        console.warn(`🔄 Transaction failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`, err.code);
        await sleep(delay);
        continue;
      }
      
      throw err;
    } finally {
      client.release();
    }
  }
  
  throw lastError;
};

// ============================================
// GET CLIENT (for manual transaction management)
// ============================================
const getClient = async () => {
  const client = await pool.connect();
  
  try {
    // Set statement timeout for this client
    await client.query(`SET statement_timeout = ${POOL_CONFIG.statementTimeout}`);
    return client;
  } catch (err) {
    client.release();
    throw err;
  }
};

// ============================================
// CONNECTION TEST
// ============================================
const testConnection = async () => {
  const startedAt = Date.now();
  console.log('🔍 Testing database connection...');
  
  try {
    const result = await withTimeout(
      query('SELECT NOW() as current_time, version() as version'),
      10000,
      'DB test query'
    );
    
    const { current_time, version } = result.rows[0];
    console.log(`✅ Database OK in ${Date.now() - startedAt}ms`);
    console.log(`   Time: ${current_time}`);
    console.log(`   ${version.split(' ').slice(0, 2).join(' ')}`);
    return true;
  } catch (err) {
    console.error(`❌ Database test failed: ${err.message}`);
    return false;
  }
};

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const closePool = async (timeoutMs = 10000) => {
  console.log('🛑 Closing PostgreSQL pool...');
  
  try {
    // Set a timeout for pool closure
    const closePromise = pool.end();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Pool close timeout')), timeoutMs)
    );
    
    await Promise.race([closePromise, timeoutPromise]);
    console.log('✅ PostgreSQL pool closed');
  } catch (err) {
    console.error('❌ Error closing pool:', err.message);
    // Force destroy remaining clients
    pool._clients?.forEach(client => client.end()?.catch(() => {}));
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  pool,
  query,
  getClient,
  withTransaction,
  testConnection,
  closePool,
  getPoolMetrics,
  POOL_CONFIG,
};
