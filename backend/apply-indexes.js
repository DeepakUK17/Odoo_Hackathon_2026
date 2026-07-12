require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sql = fs.readFileSync('./migrations/002_performance_indexes.sql', 'utf8');

pool.query(sql)
  .then(() => { console.log('✅ All performance indexes created successfully'); pool.end(); })
  .catch(e => { console.error('❌ Error:', e.message); pool.end(); });
