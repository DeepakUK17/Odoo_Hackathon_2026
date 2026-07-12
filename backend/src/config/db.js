const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,                    // Neon free tier: keep connections low
  min: 2,                     // Keep 2 connections alive to avoid cold starts
  idleTimeoutMillis: 30000,   // Release idle connections faster
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Warm up the connection pool on startup to avoid first-request cold starts
const warmupPool = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ DB pool warmed up - no cold start for first request');
  } catch (err) {
    console.error('⚠️  DB warmup failed:', err.message);
  }
};
setImmediate(warmupPool);

pool.on('connect', () => {
  console.log('✅ Connected to Neon PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('SQL:', { text: text.substring(0, 80), duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('Query error:', err.message, '\nSQL:', text);
    throw err;
  }
};

module.exports = { pool, query };
