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
      ($1, $2, $4, 'AST-001', 'MacBook Pro 16"', 'SN-MBP-001', 'allocated', 'good', 95, 2400),
      ($1, $2, $4, 'AST-002', 'Dell XPS 15', 'SN-DXPS-002', 'available', 'excellent', 100, 1800),
      ($1, $3, NULL, 'AST-003', 'Company Delivery Van', 'VIN-VAN-003', 'maintenance', 'fair', 65, 35000),
      ($1, $2, $5, 'AST-004', 'ThinkPad T14', 'SN-TP-004', 'allocated', 'good', 85, 1200),
      ($1, $2, $4, 'AST-005', 'MacBook Air M2', 'SN-MBA-005', 'available', 'excellent', 100, 1500),
      ($1, $3, NULL, 'AST-006', 'Executive Sedan', 'VIN-SED-006', 'available', 'excellent', 98, 45000)
    `, [orgId, catLaptopsId, catVehiclesId, itDeptId, hrDeptId]);

    // 6. Add Mock Allocations
    await query(`
      INSERT INTO allocations (asset_id, employee_id, status, notes)
      VALUES 
      ((SELECT id FROM assets WHERE tag='AST-001'), (SELECT id FROM employees WHERE email='admin@demo.com'), 'active', 'Assigned for IT development'),
      ((SELECT id FROM assets WHERE tag='AST-004'), (SELECT id FROM employees WHERE email='employee@demo.com'), 'active', 'Assigned for HR duties')
    `);

    // 7. Add Mock Maintenance Requests
    await query(`
      INSERT INTO maintenance_requests (asset_id, raised_by, title, description, priority, status)
      VALUES 
      ((SELECT id FROM assets WHERE tag='AST-003'), (SELECT id FROM employees WHERE email='manager@demo.com'), 'Engine Oil Leak', 'Engine oil leak and strange noise from transmission', 'high', 'in_progress'),
      ((SELECT id FROM assets WHERE tag='AST-001'), (SELECT id FROM employees WHERE email='admin@demo.com'), 'Battery Drain', 'Battery draining too quickly', 'medium', 'pending')
    `);

    // 8. Add Mock Resources and Bookings
    const resRes = await query(`
      INSERT INTO resources (org_id, name, type, location, capacity, status)
      VALUES 
      ($1, 'Conference Room A', 'room', 'Floor 1', 10, 'available'),
      ($1, 'Company Car - Prius', 'vehicle', 'Basement Parking', 5, 'available'),
      ($1, '4K Projector', 'equipment', 'IT Storage', NULL, 'available')
      RETURNING id, name
    `, [orgId]);
    const roomA = resRes.rows[0].id;
    const carPrius = resRes.rows[1].id;

    await query(`
      INSERT INTO bookings (resource_id, employee_id, title, start_time, end_time, attendees, status)
      VALUES 
      ($1, (SELECT id FROM employees WHERE email='manager@demo.com'), 'Quarterly Planning', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', 8, 'confirmed'),
      ($2, (SELECT id FROM employees WHERE email='admin@demo.com'), 'Client Visit', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 4 hours', 3, 'confirmed')
    `, [roomA, carPrius]);

    // 9. Add Mock Audits and Audit Items
    const auditRes = await query(`
      INSERT INTO audits (org_id, dept_id, name, description, start_date, end_date, status, created_by)
      VALUES 
      ($1, $2, 'Q3 IT Asset Audit', 'Quarterly inventory check of all IT equipment', CURRENT_DATE, CURRENT_DATE + 7, 'active', (SELECT id FROM employees WHERE email='admin@demo.com'))
      RETURNING id
    `, [orgId, itDeptId]);
    const auditId = auditRes.rows[0].id;

    await query(`
      INSERT INTO audit_items (audit_id, asset_id, expected_location, verification_status, notes)
      VALUES 
      ($1, (SELECT id FROM assets WHERE tag='AST-001'), 'IT Dept', 'verified', 'Asset found and in good condition'),
      ($1, (SELECT id FROM assets WHERE tag='AST-002'), 'IT Dept', 'pending', NULL),
      ($1, (SELECT id FROM assets WHERE tag='AST-004'), 'HR Dept', 'missing', 'Could not locate at the assigned desk')
    `, [auditId]);

    // 10. Add Mock Notifications
    await query(`
      INSERT INTO notifications (recipient_id, type, priority, title, message, is_read)
      VALUES 
      ((SELECT id FROM employees WHERE email='admin@demo.com'), 'maintenance', 'high', 'Maintenance Requested', 'Manager raised a high priority maintenance request for Company Delivery Van.', false),
      ((SELECT id FROM employees WHERE email='admin@demo.com'), 'audit', 'medium', 'Audit Started', 'Q3 IT Asset Audit has been initiated.', false),
      ((SELECT id FROM employees WHERE email='manager@demo.com'), 'booking', 'low', 'Booking Confirmed', 'Your booking for Conference Room A is confirmed.', true)
    `);

    console.log('✅ Comprehensive Mock Data (Assets, Allocations, Maintenance, Bookings, Audits, Notifications) created');

    console.log('🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

runSeed();
