const { Pool } = require('pg');

// Create PostgreSQL connection pool
// Note: 'ssl' configuration is required for Supabase and many cloud providers
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

// Event Listener: Log when a new client connects to the pool
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

// Event Listener: Log unexpected errors on idle clients
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Helper function to execute a single query.
 * Useful for simple queries that don't require a transaction.
 * @param {string} text - The SQL query string
 * @param {Array} params - The array of parameters for the query
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Executed query', { 
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), 
      duration, 
      rows: res.rowCount 
    });
    return res;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    throw error;
  }
};

/**
 * Helper to get a raw client from the pool.
 * Essential for transactions (BEGIN/COMMIT/ROLLBACK).
 */
const getClient = () => {
  return pool.connect();
};

/**
 * Run a quick query to verify connectivity on server start.
 */
const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connected at:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

module.exports = {
  query,
  getClient,
  pool,
  testConnection
};