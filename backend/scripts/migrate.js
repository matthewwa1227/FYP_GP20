/**
 * Database Migration Script
 * 
 * Run all SQL migration files in order
 * Usage: node scripts/migrate.js
 * Railway: railway run npm run migrate
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');
  
  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get list of already executed migrations
    const { rows: executedMigrations } = await pool.query(
      'SELECT filename FROM migrations ORDER BY id'
    );
    const executedSet = new Set(executedMigrations.map(r => r.filename));
    
    // Read all migration files
    const files = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Natural sort ensures 001, 002, 003 order
    
    console.log(`📁 Found ${sqlFiles.length} migration files`);
    console.log(`✅ Already executed: ${executedSet.size}\n`);
    
    let executedCount = 0;
    
    for (const file of sqlFiles) {
      if (executedSet.has(file)) {
        console.log(`⏭️  Skipping (already executed): ${file}`);
        continue;
      }
      
      console.log(`📝 Executing: ${file}`);
      
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = await fs.readFile(filePath, 'utf8');
      
      // Execute migration in transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        
        console.log(`✅ Completed: ${file}\n`);
        executedCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed: ${file}`);
        console.error(error.message);
        throw error;
      } finally {
        client.release();
      }
    }
    
    console.log(`\n🎉 Migrations complete! Executed: ${executedCount}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
