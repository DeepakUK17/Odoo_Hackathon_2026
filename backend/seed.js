require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Helper: run a query and return first row
const q = (client, sql, params) => client.query(sql, params || []);

const seed = async () => {
  const client = await pool.connect();
  try {
    console.log('🧹 Wiping all existing data...');
    await client.query('BEGIN');
    await client.query(`TRUNCATE TABLE activity_logs, notifications, audit_items, audits, maintenance_requests, bookings, resources, transfer_requests, allocations, assets, asset_categories, employees, departments, organizations RESTART IDENTITY CASCADE`);

    // ── 1. ORGANIZATION ──
    const org = (await q(client, `INSERT INTO organizations (name) VALUES ($1) RETURNING *`, ['TechNova Solutions Pvt. Ltd.'])).rows[0];
    const O = org.id;
    console.log('✅ Organization:', org.name);

    // ── 2. DEPARTMENTS ──
    const dIT  = (await q(client, `INSERT INTO departments (org_id, name) VALUES ($1,$2) RETURNING *`, [O, 'Information Technology'])).rows[0];
    const dHR  = (await q(client, `INSERT INTO departments (org_id, name) VALUES ($1,$2) RETURNING *`, [O, 'Human Resources'])).rows[0];
    const dFin = (await q(client, `INSERT INTO departments (org_id, name) VALUES ($1,$2) RETURNING *`, [O, 'Finance & Accounts'])).rows[0];
    const dOps = (await q(client, `INSERT INTO departments (org_id, name) VALUES ($1,$2) RETURNING *`, [O, 'Operations'])).rows[0];
    const dMkt = (await q(client, `INSERT INTO departments (org_id, name) VALUES ($1,$2) RETURNING *`, [O, 'Marketing & Design'])).rows[0];
    console.log('✅ 5 Departments created');

    // ── 3. EMPLOYEES ──
    const pw = await bcrypt.hash('password123', 10);
    const emp = async (dept, name, email, role) =>
      (await q(client, `INSERT INTO employees (org_id,dept_id,name,email,password_hash,role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [O, dept, name, email, pw, role])).rows[0];

    const admin   = await emp(dIT.id,  'Rahul Sharma',  'admin@technova.com',     'admin');
    const manager = await emp(dIT.id,  'Priya Menon',   'manager@technova.com',   'asset_manager');
    const dhead   = await emp(dHR.id,  'Arun Kumar',    'dept.head@technova.com', 'dept_head');
    const sneha   = await emp(dIT.id,  'Sneha Iyer',    'sneha@technova.com',     'employee');
    const vikram  = await emp(dFin.id, 'Vikram Nair',   'vikram@technova.com',    'employee');
    const divya   = await emp(dMkt.id, 'Divya Pillai',  'divya@technova.com',     'employee');
    const karthik = await emp(dOps.id, 'Karthik Rajan', 'karthik@technova.com',   'employee');
    const meera   = await emp(dIT.id,  'Meera Suresh',  'meera@technova.com',     'employee');
    console.log('✅ 8 Employees created  (password: password123)');

    // ── 4. ASSET CATEGORIES ──
    const cat = async (name, icon, color, desc) =>
      (await q(client, `INSERT INTO asset_categories (org_id,name,icon,color,description) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [O, name, icon, color, desc])).rows[0];

    const cLap  = await cat('Laptops & Computers', 'laptop',     '#6C63FF', 'Laptops, desktops, workstations');
    const cMob  = await cat('Mobile Devices',       'smartphone', '#00D4AA', 'Smartphones, tablets, wearables');
    const cNet  = await cat('Networking',           'wifi',       '#3B82F6', 'Switches, routers, firewalls, APs');
    const cOff  = await cat('Office Equipment',     'printer',    '#FF6B35', 'Printers, projectors, scanners');
    const cFurn = await cat('Furniture',            'chair',      '#FFD32A', 'Chairs, desks, cabinets');
    console.log('✅ 5 Asset Categories created');

    // ── 5. ASSETS ──
    const asset = async (tag, name, catId, serial, model, mfr, pd, cost, ws, we, loc, deptId, status, cond, health) =>
      (await q(client,
        `INSERT INTO assets (org_id,tag,name,category_id,serial_number,model,manufacturer,purchase_date,purchase_cost,warranty_start,warranty_end,location,dept_id,status,condition,health_score,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [O, tag, name, catId, serial, model, mfr, pd, cost, ws, we, loc, deptId, status, cond, health, admin.id]
      )).rows[0];

    const a1  = await asset('AF-0001','MacBook Pro 14 M3',          cLap.id, 'C02ZK3MDMD6T','MacBook Pro 14',   'Apple',       '2023-01-15', 145000,'2023-01-15','2026-01-15','IT Room Floor 2',   dIT.id,  'allocated',  'excellent', 95);
    const a2  = await asset('AF-0002','Dell OptiPlex 7090 Desktop',  cLap.id, 'DLLX7090-2042','OptiPlex 7090',  'Dell',        '2022-06-10',  62000,'2022-06-10','2025-06-10','Finance Cabin 3A',  dFin.id, 'allocated',  'good',      80);
    const a3  = await asset('AF-0003','HP LaserJet Pro M404dn',      cOff.id, 'HPLJ404-0091', 'LaserJet M404',  'HP',          '2022-09-01',  28000,'2022-09-01','2024-09-01','HR Department',     dHR.id,  'available',  'good',      72);
    const a4  = await asset('AF-0004','iPhone 14 Pro',               cMob.id, 'IPHN14P-8823', 'iPhone 14 Pro',  'Apple',       '2023-03-20', 110000,'2023-03-20','2025-03-20','Operations Desk 2', dOps.id, 'allocated',  'excellent', 98);
    const a5  = await asset('AF-0005','Cisco Catalyst 2960-X Switch', cNet.id,'CSCO2960-5512','Catalyst 2960-X','Cisco',       '2021-11-05',  45000,'2021-11-05','2024-11-05','Server Room B1',    dIT.id,  'available',  'fair',      65);
    const a6  = await asset('AF-0006','Samsung Galaxy Tab S9',        cMob.id,'SGTS9-7734',  'Galaxy Tab S9',   'Samsung',     '2023-07-12',  68000,'2023-07-12','2025-07-12','Marketing Zone 1',  dMkt.id, 'allocated',  'excellent', 92);
    const a7  = await asset('AF-0007','Lenovo ThinkPad X1 Carbon',    cLap.id,'LNVX1C-3391', 'ThinkPad X1',    'Lenovo',      '2022-04-18',  98000,'2022-04-18','2025-04-18','HR Room Floor 1',   dIT.id,  'maintenance','fair',      45);
    const a8  = await asset('AF-0008','Epson EB-X51 Projector',       cOff.id,'EPSBX51-6621','EB-X51',          'Epson',       '2021-08-22',  35000,'2021-08-22','2023-08-22','Conference Room A', dIT.id,  'available',  'good',      78);
    const a9  = await asset('AF-0009','HP EliteBook 840 G9',          cLap.id,'HPEB840-9918','EliteBook 840 G9','HP',          '2023-02-10',  88000,'2023-02-10','2026-02-10','Finance Cabin 1B',  dFin.id, 'available',  'excellent', 90);
    const a10 = await asset('AF-0010','Ergonomic Executive Chair',    cFurn.id,'EGO-CHR-1122','ErgoMax Pro 500','Featherlite', '2022-12-01',  18000, null,        null,        'CEO Cabin',         dOps.id, 'allocated',  'good',      85);
    console.log('✅ 10 Assets created');

    // ── 6. ALLOCATIONS ──
    const alloc = async (assetId, empId, deptId, retDays, overdueNote) => {
      const ret = retDays !== null
        ? `CURRENT_DATE + INTERVAL '${retDays} days'`
        : 'NULL';
      return q(client,
        `INSERT INTO allocations (asset_id,employee_id,dept_id,allocated_by,allocated_at,expected_return,status,notes)
         VALUES ($1,$2,$3,$4,NOW()-INTERVAL '20 days',${ret},'active',$5) RETURNING *`,
        [assetId, empId, deptId, manager.id, overdueNote]
      );
    };
    await alloc(a1.id,  sneha.id,   dIT.id,  90,  'Primary work laptop for Sneha Iyer – IT Department');
    await alloc(a2.id,  vikram.id,  dFin.id, 30,  'Desktop for finance data processing – Vikram Nair');
    await q(client,
      `INSERT INTO allocations (asset_id,employee_id,dept_id,allocated_by,allocated_at,expected_return,status,notes)
       VALUES ($1,$2,$3,$4,NOW()-INTERVAL '35 days',CURRENT_DATE-INTERVAL '5 days','active',$5)`,
      [a4.id, karthik.id, dOps.id, manager.id, 'Field phone – OVERDUE by 5 days – Karthik Rajan']);
    await alloc(a6.id,  divya.id,   dMkt.id, 60,  'Marketing design tablet for Divya Pillai');
    await alloc(a9.id,  meera.id,   dIT.id,  50,  'Laptop for Meera Suresh – IT support role');
    await q(client,
      `INSERT INTO allocations (asset_id,employee_id,dept_id,allocated_by,allocated_at,expected_return,status,notes)
       VALUES ($1,$2,$3,$4,NOW()-INTERVAL '60 days',CURRENT_DATE-INTERVAL '30 days','returned',$5)`,
      [a3.id, dhead.id, dHR.id, manager.id, 'Returned in good condition after HR team audit']);
    console.log('✅ 6 Allocations (1 overdue, 1 returned)');

    // ── 7. TRANSFER REQUESTS ──
    await q(client,`INSERT INTO transfer_requests (asset_id,from_employee_id,to_employee_id,requested_by,reason,status) VALUES ($1,$2,$3,$4,$5,$6)`,
      [a1.id, sneha.id, vikram.id, sneha.id, 'Sneha temporarily shifting to Finance project. Needs laptop there.',           'pending']);
    await q(client,`INSERT INTO transfer_requests (asset_id,from_employee_id,to_employee_id,requested_by,reason,status) VALUES ($1,$2,$3,$4,$5,$6)`,
      [a4.id, karthik.id, meera.id, manager.id, 'Karthik no longer needs field phone. Transferring to Meera for ops work.',  'approved']);
    await q(client,`INSERT INTO transfer_requests (asset_id,from_employee_id,to_employee_id,requested_by,reason,status) VALUES ($1,$2,$3,$4,$5,$6)`,
      [a2.id, vikram.id, divya.id, vikram.id, 'Vikram moving to Marketing team for Q3 campaign. Needs desktop there.',       'pending']);
    await q(client,`INSERT INTO transfer_requests (asset_id,from_employee_id,to_employee_id,requested_by,reason,status) VALUES ($1,$2,$3,$4,$5,$6)`,
      [a3.id, null,      karthik.id, manager.id,'New joiner in Ops needs a printer urgently. Reallocating from HR.',         'rejected']);
    await q(client,`INSERT INTO transfer_requests (asset_id,from_employee_id,to_employee_id,requested_by,reason,status) VALUES ($1,$2,$3,$4,$5,$6)`,
      [a9.id, null,      sneha.id, manager.id, 'Sneha requested additional laptop for remote work from home setup.',          'pending']);
    console.log('✅ 5 Transfer Requests');

    // ── 8. MAINTENANCE REQUESTS ──
    await q(client,`INSERT INTO maintenance_requests (asset_id,raised_by,assigned_to,title,description,priority,status,estimated_cost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [a7.id, sneha.id,   dhead.id, 'ThinkPad Battery Swelling Issue',    'Battery shows physical swelling – safety hazard. Immediate replacement needed.',          'critical','in_progress', 4500]);
    await q(client,`INSERT INTO maintenance_requests (asset_id,raised_by,assigned_to,title,description,priority,status,estimated_cost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [a5.id, manager.id, dhead.id, 'Cisco Switch Port Failure',           'Three ports non-functional – causing network drops in server room.',                     'high',    'assigned',    8000]);
    await q(client,`INSERT INTO maintenance_requests (asset_id,raised_by,title,description,priority,status,estimated_cost) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [a1.id, sneha.id,              'MacBook Screen Flickering',           'Screen flickers randomly at high brightness. Likely display ribbon cable issue.',         'medium',  'pending',     6000]);
    await q(client,`INSERT INTO maintenance_requests (asset_id,raised_by,assigned_to,title,description,priority,status,estimated_cost,actual_cost,resolution_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [a3.id, manager.id, dhead.id, 'HP Printer Paper Jam Repair',         'Persistent paper jam in Tray 2. Mechanic assessed – feed roller needs replacement.',     'low',    'resolved',    1200, 950, 'Roller replaced and tested. Working perfectly.']);
    await q(client,`INSERT INTO maintenance_requests (asset_id,raised_by,assigned_to,title,description,priority,status,estimated_cost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [a8.id, manager.id, dhead.id, 'Epson Projector Lamp Replacement',    'Lamp exceeds 3000h. Image very dim. Immediate replacement required.',                    'high',   'approved',    3500]);
    await q(client,`INSERT INTO maintenance_requests (asset_id,raised_by,title,description,priority,status,estimated_cost) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [a4.id, karthik.id,            'iPhone Screen Cracked',               'Dropped during field visit – screen shattered. Urgent repair needed.',                   'critical','pending',     5000]);
    console.log('✅ 6 Maintenance Requests');

    // ── 9. RESOURCES ──
    const res = async (name, type, loc, cap, desc) =>
      (await q(client, `INSERT INTO resources (org_id,name,type,location,capacity,description,status) VALUES ($1,$2,$3,$4,$5,$6,'available') RETURNING *`,
        [O, name, type, loc, cap, desc])).rows[0];

    const rAlpha  = await res('Conference Room Alpha',       'room',     'Floor 2, Block A', 20, 'Main boardroom – projector, whiteboard, video conferencing');
    const rBeta   = await res('Meeting Room Beta',           'room',     'Floor 1, Block B',  8, 'Huddle room with 65 inch TV and 4G wifi');
    const rInnova = await res('Toyota Innova – TN09AB1234', 'vehicle',  'Basement Parking',  7, 'Company car for client visits and airport transfers');
    const rGamma  = await res('Training Room Gamma',         'room',     'Floor 3, Block C', 30, 'Training hall – 4 projectors and 30 workstations');
    const rCam    = await res('Canon EOS R5 Camera Kit',     'equipment','Media Cupboard 2B', 1, 'Pro camera kit for marketing shoots and product photography');
    const rScorp  = await res('Mahindra Scorpio – TN05CD5678','vehicle', 'Basement Parking',  6, 'Field ops vehicle for site visits and factory audits');
    console.log('✅ 6 Resources created');

    // ── 10. BOOKINGS ──
    const book = async (rid, eid, title, startOff, endOff, att, notes, status) =>
      q(client,
        `INSERT INTO bookings (resource_id,employee_id,title,start_time,end_time,attendees,notes,status)
         VALUES ($1,$2,$3,NOW()+INTERVAL '${startOff}',NOW()+INTERVAL '${endOff}',$4,$5,$6)`,
        [rid, eid, title, att, notes, status]
      );

    await book(rAlpha.id, vikram.id,  'Q3 Board Review Meeting',           '2 days 10 hours','2 days 12 hours',  18,'All HODs attending. Quarterly financial review.',       'confirmed');
    await book(rBeta.id,  divya.id,   'Design Sprint – Mobile App UX',     '1 day 9 hours',  '1 day 17 hours',    6,'Week-long sprint for new consumer mobile app redesign.','confirmed');
    await book(rInnova.id,karthik.id, 'Client Visit – TCS HQ Chennai',     '3 days 8 hours', '3 days 18 hours',   4,'Sales demo and contract negotiation with TCS team.',    'confirmed');
    await q(client,
      `INSERT INTO bookings (resource_id,employee_id,title,start_time,end_time,attendees,notes,status)
       VALUES ($1,$2,$3,NOW()-INTERVAL '1 day 11 hours',NOW()-INTERVAL '1 day 9 hours',$4,$5,$6)`,
      [rAlpha.id, sneha.id, 'IT Team Monthly Townhall', 22, 'Reviewed infra upgrades and Q3 roadmap.', 'completed']);
    await book(rGamma.id, manager.id, 'New Employee Onboarding – Batch 7', '5 days 9 hours', '5 days 17 hours',  25,'Orientation for 12 new joiners. HR facilitated.',        'confirmed');
    await book(rCam.id,   meera.id,   'Product Launch Photography',        '4 days 13 hours','4 days 16 hours',   1,'AF-X Pro product line launch shoot.',                   'confirmed');
    await book(rScorp.id, divya.id,   'Site Survey – Pune Factory Visit',  '6 days 7 hours', '6 days 19 hours',   5,'EHS and safety audit at factory floor with ops team.',  'confirmed');
    console.log('✅ 7 Bookings created');

    // ── 11. AUDITS + ITEMS ──
    const audit = async (deptId, name, desc, start, end, status, createdBy) =>
      (await q(client,
        `INSERT INTO audits (org_id,dept_id,name,description,start_date,end_date,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [O, deptId, name, desc, start, end, status, createdBy]
      )).rows[0];

    const au1 = await audit(dIT.id,  'Q2 IT Asset Physical Verification',      'Full physical check of all IT assets for Q2 compliance report.',          '2026-07-01','2026-07-15','active', manager.id);
    const au2 = await audit(dHR.id,  'HR Department Asset Spot Check',          'Spot check of HR laptops and furniture – random sample verification.',    '2026-07-05','2026-07-10','active', manager.id);
    const au3 = await audit(null,    'Full Organization Inventory Audit 2026',  'Annual complete inventory verification across all departments.',           '2026-06-01','2026-06-30','closed', admin.id);
    const au4 = await audit(dFin.id, 'Finance Year-end Asset Count',            'Year-end asset count and depreciation review for Finance department.',    '2026-07-10','2026-07-20','active', manager.id);
    const au5 = await audit(dIT.id,  'Server Room Equipment Quarterly Check',   'Quarterly health check of all networking and server room equipment.',     '2026-07-12','2026-07-14','active', manager.id);

    const ai = async (auditId, assetId, expLoc, actLoc, vstatus, notes, verBy) => {
      if (vstatus === 'pending') {
        return q(client,
          `INSERT INTO audit_items (audit_id,asset_id,expected_location,verification_status) VALUES ($1,$2,$3,'pending')`,
          [auditId, assetId, expLoc]);
      }
      return q(client,
        `INSERT INTO audit_items (audit_id,asset_id,expected_location,actual_location,verification_status,notes,verified_by,verified_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()-INTERVAL '2 days')`,
        [auditId, assetId, expLoc, actLoc, vstatus, notes, verBy]);
    };

    // Audit 1 – IT
    await ai(au1.id, a1.id, 'IT Room Floor 2',   'IT Room Floor 2',   'verified','Asset in good condition, QR sticker intact.',      manager.id);
    await ai(au1.id, a7.id, 'IT Room Floor 2',   'HR Room Floor 1',   'missing', 'Not at expected location. Escalated to IT head.',   manager.id);
    await ai(au1.id, a5.id, 'Server Room B1',    'Server Room B1',    'verified','All ports tagged and accounted for.',               manager.id);
    await ai(au1.id, a8.id, 'Conference Room A', 'Conference Room A', 'damaged', 'Projector fan making loud noise – repair raised.',  manager.id);
    await ai(au1.id, a9.id, 'Finance Cabin 1B',  null,                'pending', null, null);

    // Audit 2 – HR
    await ai(au2.id, a7.id, 'HR Room Floor 1', 'HR Room Floor 1', 'verified','Laptop found. Battery swelling noted separately.',  manager.id);
    await ai(au2.id, a3.id, 'HR Department',   null,              'pending', null, null);

    // Audit 3 – Org (closed)
    await ai(au3.id, a1.id, 'IT Room Floor 2', 'IT Room Floor 2', 'verified','Confirmed. Tag and serial match.',                  manager.id);
    await ai(au3.id, a7.id, 'IT Room Floor 2', 'HR Room Floor 1', 'verified','Located in HR. Transfer request raised.',           manager.id);
    await ai(au3.id, a3.id, 'HR Department',   'HR Department',   'verified','HP Printer verified and calibrated.',               manager.id);

    // Audit 4 – Finance
    await ai(au4.id, a2.id, 'Finance Cabin 3A', 'Finance Cabin 3A', 'verified','Desktop verified – serial and tag matched.',       manager.id);
    await ai(au4.id, a9.id, 'Finance Cabin 1B', null,               'pending', null, null);

    // Audit 5 – Server Room
    await ai(au5.id, a5.id, 'Server Room B1', 'Server Room B1', 'verified','Cisco Switch verified. 3 ports flagged for repair.', manager.id);
    await ai(au5.id, a7.id, 'IT Room Floor 2', null,            'pending', null, null);

    console.log('✅ 5 Audits + 14 Audit Items created');

    // ── 12. NOTIFICATIONS ──
    const notif = async (rid, type, prio, title, msg, read, eType, eId) =>
      q(client,
        `INSERT INTO notifications (recipient_id,type,priority,title,message,is_read,entity_type,entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [rid, type, prio, title, msg, read, eType, eId]
      );

    await notif(manager.id,'overdue',        'high',  'Overdue Return: AF-0004 iPhone 14 Pro',      'iPhone 14 Pro assigned to Karthik Rajan is overdue by 5 days. Immediate follow-up required.',     false,'allocation',  3);
    await notif(manager.id,'maintenance',    'high',  'Critical Alert: ThinkPad Battery Swelling',  'AF-0007 ThinkPad battery swelling is a fire hazard. Maintenance request #1 raised.',              false,'maintenance', 1);
    await notif(manager.id,'warranty',       'medium','Warranty Expiring: AF-0005 Cisco Switch',    'Cisco Catalyst 2960-X warranty expires in 28 days. Consider renewal or upgrade.',                 true, 'asset',       5);
    await notif(sneha.id,  'allocation',     'medium','Asset Assigned: MacBook Pro 14 AF-0001',     'MacBook Pro 14 M3 (AF-0001) allocated to you. Please confirm receipt.',                           true, 'allocation',  1);
    await notif(karthik.id,'return_reminder','medium','Return Reminder: AF-0004 iPhone 14 Pro',     'Your field device iPhone 14 Pro was due for return on 07-Jul-2026. Please return immediately.',   false,'allocation',  3);
    await notif(manager.id,'audit',          'low',   'Audit Flag: AF-0007 Marked as Missing',      'ThinkPad X1 Carbon (AF-0007) was flagged MISSING in Q2 IT Audit. Investigation in progress.',    false,'audit',       1);
    await notif(manager.id,'transfer',       'low',   'Transfer Approved: AF-0004 iPhone',          'Transfer of iPhone 14 Pro from Karthik to Meera Suresh has been approved and processed.',         true, 'transfer',    2);
    await notif(meera.id,  'allocation',     'medium','New Laptop Allocated: HP EliteBook 840',     'HP EliteBook 840 G9 (AF-0009) allocated to you. Return due by 01-Sep-2026.',                     false,'allocation',  5);
    console.log('✅ 8 Notifications created');

    // ── 13. ACTIVITY LOGS ──
    const log = async (actorId, action, eType, eId, desc) =>
      q(client,
        `INSERT INTO activity_logs (org_id,actor_id,action,entity_type,entity_id,description) VALUES ($1,$2,$3,$4,$5,$6)`,
        [O, actorId, action, eType, eId, desc]
      );

    await log(admin.id,   'asset.registered',    'asset',       1, 'Registered AF-0001 MacBook Pro 14 M3 for IT Department');
    await log(manager.id, 'asset.allocated',     'allocation',  1, 'Allocated MacBook Pro 14 (AF-0001) to Sneha Iyer');
    await log(manager.id, 'asset.allocated',     'allocation',  3, 'Allocated iPhone 14 Pro (AF-0004) to Karthik Rajan – Operations');
    await log(sneha.id,   'maintenance.raised',  'maintenance', 1, 'Raised critical maintenance – ThinkPad X1 Carbon battery swelling');
    await log(manager.id, 'maintenance.approved','maintenance', 5, 'Approved Epson Projector Lamp replacement – estimated Rs.3500');
    await log(manager.id, 'audit.created',       'audit',       1, 'Created Q2 IT Asset Verification audit – 5 assets auto-populated');
    await log(manager.id, 'audit.item.verified', 'audit',       1, 'Verified AF-0001 at IT Room Floor 2 – condition good');
    await log(manager.id, 'audit.item.missing',  'audit',       1, 'AF-0007 ThinkPad flagged MISSING in Q2 IT Audit – escalated');
    await log(manager.id, 'transfer.approved',   'transfer',    2, 'Approved transfer of iPhone 14 Pro from Karthik to Meera');
    await log(sneha.id,   'booking.created',     'booking',     1, 'Booked Conference Room Alpha for IT Team Monthly Townhall');
    console.log('✅ 10 Activity Logs created');

    await client.query('COMMIT');

    console.log('\n🎉 ─────────────────────────────────────────────────────');
    console.log('   SEED COMPLETE!  TechNova Solutions Pvt. Ltd. is ready.');
    console.log('─────────────────────────────────────────────────────────');
    console.log('📧 All accounts use password: password123');
    console.log('');
    console.log('   👑 Admin:         admin@technova.com         (Rahul Sharma)');
    console.log('   📦 Asset Manager: manager@technova.com       (Priya Menon)');
    console.log('   🏢 Dept Head:     dept.head@technova.com     (Arun Kumar)');
    console.log('   👤 Employee:      sneha@technova.com         (has MacBook allocated)');
    console.log('   👤 Employee:      karthik@technova.com       (has iPhone – OVERDUE return)');
    console.log('   👤 Employee:      divya@technova.com         (has Galaxy Tab)');
    console.log('   👤 Employee:      vikram@technova.com        (has Dell Desktop)');
    console.log('   👤 Employee:      meera@technova.com         (has HP EliteBook)');
    console.log('─────────────────────────────────────────────────────────\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ SEED FAILED:', err.message);
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
