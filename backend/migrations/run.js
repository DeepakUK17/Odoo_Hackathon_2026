const { query } = require('../src/config/db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  console.log('🚀 Running database migrations...');
  const sqlFile = path.join(__dirname, '001_initial_schema.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  try {
    await query(sql);
    console.log('✅ Migration 001 completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigrations();
