const path = require('path');
const dotenv = require('dotenv');

// Load .env from server dir, root dir, or fallback to .env.example
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.example') });
dotenv.config();

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('WARNING: DATABASE_URL environment variable is not defined!');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Execute a query with automatic retry for Neon database cold-starts.
 */
async function queryWithRetry(text, params, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      attempt++;
      // If error is network or connection related and we have retries left
      if (attempt <= maxRetries && (err.code === 'ECONNRESET' || err.code === '57P01' || err.message.includes('timeout') || err.message.includes('connection'))) {
        console.warn(`[DB Retry] Attempt ${attempt} failed: ${err.message}. Retrying in 1s...`);
        await new Promise(res => setTimeout(res, 1000));
      } else {
        throw err;
      }
    }
  }
}

module.exports = {
  pool,
  query: (text, params) => queryWithRetry(text, params)
};
