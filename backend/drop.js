require('dotenv').config();
const { query } = require('./src/config/db');

async function dropAll() {
  try {
    await query(`
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS maintenance_requests CASCADE;
      DROP TABLE IF EXISTS asset_transfers CASCADE;
      DROP TABLE IF EXISTS resource_bookings CASCADE;
      DROP TABLE IF EXISTS resources CASCADE;
      DROP TABLE IF EXISTS assets CASCADE;
      DROP TABLE IF EXISTS asset_categories CASCADE;
      DROP TABLE IF EXISTS employees CASCADE;
      DROP TABLE IF EXISTS departments CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
    `);
    console.log('✅ All tables dropped successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to drop tables:', err);
    process.exit(1);
  }
}

dropAll();
