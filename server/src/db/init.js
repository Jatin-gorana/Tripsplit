const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function initDb() {
  console.log('Initializing database schema...');
  try {
    const schemaPath = path.join(__dirname, '../../../schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schemaSql);
    console.log('Database schema successfully initialized!');
  } catch (err) {
    console.error('Error initializing database schema:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
