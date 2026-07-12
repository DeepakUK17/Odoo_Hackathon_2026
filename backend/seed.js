require('dotenv').config();
const { query } = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function runSeed() {
  console.log('🌱 Starting Database Seed...');
  try {
    // 1. Create Organization
    const orgRes = await query(`
      INSERT INTO organizations (name)
      VALUES ('Demo Enterprise')
      RETURNING id
    `);
    const orgId = orgRes.rows[0].id;
    console.log(`✅ Organization created with ID: ${orgId}`);

    // 2. Create Departments
    const itDeptRes = await query(`INSERT INTO departments (org_id, name) VALUES ($1, 'Information Technology') RETURNING id`, [orgId]);
    const hrDeptRes = await query(`INSERT INTO departments (org_id, name) VALUES ($1, 'Human Resources') RETURNING id`, [orgId]);
    const itDeptId = itDeptRes.rows[0].id;
    const hrDeptId = hrDeptRes.rows[0].id;
    
    // 3. Create Categories
    const catLaptopsRes = await query(`INSERT INTO asset_categories (org_id, name, icon, color) VALUES ($1, 'Laptops', '💻', '#6C63FF') RETURNING id`, [orgId]);
    const catVehiclesRes = await query(`INSERT INTO asset_categories (org_id, name, icon, color) VALUES ($1, 'Vehicles', '🚗', '#FF6B35') RETURNING id`, [orgId]);
    const catLaptopsId = catLaptopsRes.rows[0].id;
    const catVehiclesId = catVehiclesRes.rows[0].id;

    // 4. Create Users (Admin, Manager, Employee)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('demo123', salt);

    await query(`
      INSERT INTO employees (org_id, dept_id, name, email, password_hash, role)
      VALUES 
      ($1, $2, 'Alice Admin', 'admin@demo.com', $3, 'admin'),
      ($1, $2, 'Mike Manager', 'manager@demo.com', $3, 'asset_manager'),
      ($1, $2, 'David DeptHead', 'head@demo.com', $3, 'dept_head'),
      ($1, $4, 'Emma Employee', 'employee@demo.com', $3, 'employee')
    `, [orgId, itDeptId, passwordHash, hrDeptId]);
    console.log('✅ Demo Users created (admin, asset_manager, dept_head, employee)');

    // 5. Create some Assets
    await query(`
      INSERT INTO assets (org_id, category_id, dept_id, tag, name, serial_number, status, condition, health_score, purchase_cost)
      VALUES 
      ($1, $2, $4, 'AST-001', 'MacBook Pro 16"', 'SN-MBP-001', 'available', 'good', 95, 2400),
      ($1, $2, $4, 'AST-002', 'Dell XPS 15', 'SN-DXPS-002', 'available', 'excellent', 100, 1800),
      ($1, $3, NULL, 'AST-003', 'Company Delivery Van', 'VIN-VAN-003', 'maintenance', 'fair', 65, 35000),
      ($1, $2, $5, 'AST-004', 'ThinkPad T14', 'SN-TP-004', 'available', 'good', 85, 1200)
    `, [orgId, catLaptopsId, catVehiclesId, itDeptId, hrDeptId]);
    console.log('✅ Demo Assets created');

    console.log('🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

runSeed();
