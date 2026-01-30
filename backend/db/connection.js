// connection.js
// Supabase Postgres connection helper (pg Pool) with fast-fail timeouts + diagnostics

const { Pool } = require('pg');

const withTimeout = (promise, ms, label = 'operation') => {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
};

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
};

// Read DATABASE_URL once
const DATABASE_URL = requireEnv('DATABASE_URL');

// Print safe target (no password)
let safeTarget = '(invalid DATABASE_URL)';
try {
  const u = new URL(DATABASE_URL);
  safeTarget = `${u.hostname}:${u.port || '(default)'}${u.pathname}`;
} catch (_) {}
console.log(`🧭 Postgres target: ${safeTarget}`);

// Create pool
const pool = new Pool({
  connectionString: DATABASE_URL,

  // Supabase/cloud Postgres usually requires SSL.
  // If you use the direct host: db.<ref>.supabase.co this is typically required.
  ssl: { rejectUnauthorized: false },

  // Client-side timeouts
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  max: 10,

  // NOTE: "statement_timeout" / "query_timeout" are not standard pg Pool options.
  // If you want statement timeout, set it per-connection in testConnection() below.
});

// Pool events
pool.on('connect', () => {
  console.log('✅ PostgreSQL client connected (pool created a new client)');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle PostgreSQL client:', err.message);
});

// Query helper
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    console.log('📊 Query OK', {
      ms: Date.now() - start,
      rows: res.rowCount,
      sql: text.length > 120 ? `${text.slice(0, 120)}...` : text,
    });
    return res;
  } catch (err) {
    console.error('❌ Query failed', {
      ms: Date.now() - start,
      message: err.message,
      code: err.code,
    });
    throw err;
  }
};

// For transactions
const getClient = () => pool.connect();

// Startup connectivity test (connect + query) with clear failure mode
const testConnection = async () => {
  const startedAt = Date.now();
  console.log('🔍 Testing database connection (timeout 10s)...');

  let client;
  try {
    client = await withTimeout(pool.connect(), 10_000, 'DB connect');

    // Optional: set a server-side statement timeout for this session (10s)
    // This is the most reliable way (works regardless of client config).
    await client.query(`SET statement_timeout TO '10s'`);

    const res = await withTimeout(
      client.query('SELECT NOW() AS current_time'),
      10_000,
      'DB query'
    );

    console.log(
      `✅ Database OK in ${Date.now() - startedAt}ms at:`,
      res.rows[0].current_time
    );
    return true;
  } catch (err) {
    console.error(`❌ Database test failed after ${Date.now() - startedAt}ms`);
    console.error('   Message:', err.message);
    if (err.code) console.error('   Code:', err.code);
    return false;
  } finally {
    if (client) client.release();
  }
};

// Graceful shutdown
const closePool = async () => {
  try {
    await pool.end();
    console.log('🛑 PostgreSQL pool closed');
  } catch (err) {
    console.error('❌ Error closing PostgreSQL pool:', err.message);
  }
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  closePool,
};