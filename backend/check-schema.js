require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const checkColumns = async () => {
  const tables = ['activity_logs', 'notifications', 'transfer_requests', 'maintenance_requests'];
  for (const t of tables) {
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [t]
    );
    console.log(`\n${t}:`, r.rows.map(x => x.column_name).join(', '));
  }
  await pool.end();
};

checkColumns().catch(e => { console.error(e.message); pool.end(); });
