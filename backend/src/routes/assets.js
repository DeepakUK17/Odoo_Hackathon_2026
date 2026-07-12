const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate, requireManager } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const { generateQR } = require('../utils/qrGenerator');
const { computeHealthScore } = require('../services/healthScore');

// GET /api/assets
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, category_id, dept_id, location, search, health_min, health_max } = req.query;
    let sql = `
      SELECT a.*, ac.name as category_name, ac.color as category_color,
             d.name as dept_name,
             alloc.employee_id as current_holder_id,
             e.name as current_holder_name,
             (
               SELECT au.start_date 
               FROM audit_items ai 
               JOIN audits au ON ai.audit_id = au.id 
               WHERE ai.asset_id = a.id AND au.status = 'active' AND au.start_date >= CURRENT_DATE
               ORDER BY au.start_date ASC 
               LIMIT 1
             ) as next_audit_date
      FROM assets a
      LEFT JOIN asset_categories ac ON a.category_id = ac.id
      LEFT JOIN departments d ON a.dept_id = d.id
      LEFT JOIN allocations alloc ON alloc.asset_id = a.id AND alloc.status = 'active'
      LEFT JOIN employees e ON alloc.employee_id = e.id
      WHERE a.org_id = $1
    `;
    const params = [req.user.org_id];
    let i = 2;
    if (status) { sql += ` AND a.status = $${i++}`; params.push(status); }
    if (category_id) { sql += ` AND a.category_id = $${i++}`; params.push(category_id); }
    if (dept_id) { sql += ` AND a.dept_id = $${i++}`; params.push(dept_id); }
    if (location) { sql += ` AND a.location ILIKE $${i++}`; params.push(`%${location}%`); }
    if (health_min) { sql += ` AND a.health_score >= $${i++}`; params.push(health_min); }
    if (health_max) { sql += ` AND a.health_score <= $${i++}`; params.push(health_max); }
    if (search) {
      sql += ` AND (a.name ILIKE $${i} OR a.tag ILIKE $${i} OR a.serial_number ILIKE $${i} OR a.location ILIKE $${i})`;
      params.push(`%${search}%`); i++;
    }
    sql += ' ORDER BY a.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/assets/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, ac.name as category_name, d.name as dept_name,
              alloc.employee_id as current_holder_id, e.name as current_holder_name, e.email as current_holder_email
       FROM assets a
       LEFT JOIN asset_categories ac ON a.category_id = ac.id
       LEFT JOIN departments d ON a.dept_id = d.id
       LEFT JOIN allocations alloc ON alloc.asset_id = a.id AND alloc.status = 'active'
       LEFT JOIN employees e ON alloc.employee_id = e.id
       WHERE a.id = $1 AND a.org_id = $2`,
      [req.params.id, req.user.org_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Asset not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/assets/:id/timeline
router.get('/:id/timeline', authenticate, async (req, res) => {
  try {
    const assetId = req.params.id;
    const asset = await query('SELECT id, tag, name, created_at FROM assets WHERE id = $1 AND org_id = $2', [assetId, req.user.org_id]);
    if (!asset.rows[0]) return res.status(404).json({ error: 'Asset not found' });

    // Build unified timeline from multiple tables
    const events = [];

    // Purchase/creation event
    events.push({ event: 'registered', description: `Asset ${asset.rows[0].tag} registered`, date: asset.rows[0].created_at, icon: 'plus-circle' });

    // Allocations
    const allocs = await query(
      `SELECT al.*, e.name as employee_name, d.name as dept_name
       FROM allocations al LEFT JOIN employees e ON al.employee_id = e.id LEFT JOIN departments d ON al.dept_id = d.id
       WHERE al.asset_id = $1 ORDER BY al.allocated_at ASC`, [assetId]
    );
    allocs.rows.forEach(a => {
      events.push({ event: 'allocated', description: `Allocated to ${a.employee_name} (${a.dept_name || 'N/A'})`, date: a.allocated_at, icon: 'user-check' });
      if (a.returned_at) events.push({ event: 'returned', description: `Returned by ${a.employee_name} — Condition: ${a.return_condition || 'N/A'}`, date: a.returned_at, icon: 'rotate-ccw' });
    });

    // Transfers
    const transfers = await query(
      `SELECT tr.*, f.name as from_name, t.name as to_name
       FROM transfer_requests tr LEFT JOIN employees f ON tr.from_employee_id = f.id LEFT JOIN employees t ON tr.to_employee_id = t.id
       WHERE tr.asset_id = $1 AND tr.status = 'approved' ORDER BY tr.resolved_at ASC`, [assetId]
    );
    transfers.rows.forEach(t => events.push({ event: 'transferred', description: `Transferred from ${t.from_name || 'N/A'} to ${t.to_name}`, date: t.resolved_at, icon: 'arrow-right' }));

    // Maintenance
    const maint = await query(
      `SELECT mr.*, e.name as technician_name FROM maintenance_requests mr LEFT JOIN employees e ON mr.assigned_to = e.id
       WHERE mr.asset_id = $1 ORDER BY mr.created_at ASC`, [assetId]
    );
    maint.rows.forEach(m => {
      events.push({ event: 'maintenance_raised', description: `Maintenance: ${m.title} (${m.priority} priority)`, date: m.created_at, icon: 'tool' });
      if (m.resolved_at) events.push({ event: 'maintenance_resolved', description: `Maintenance resolved${m.technician_name ? ` by ${m.technician_name}` : ''}`, date: m.resolved_at, icon: 'check-circle' });
    });

    // Audits
    const audits = await query(
      `SELECT ai.*, au.name as audit_name, e.name as verified_by_name
       FROM audit_items ai
       JOIN audits au ON ai.audit_id = au.id
       LEFT JOIN employees e ON ai.verified_by = e.id
       WHERE ai.asset_id = $1 AND ai.verified_at IS NOT NULL`, [assetId]
    );
    audits.rows.forEach(a => {
      events.push({ event: 'audited', description: `Audited during "${a.audit_name}" — Status: ${a.verification_status}${a.verified_by_name ? ` by ${a.verified_by_name}` : ''}`, date: a.verified_at, icon: 'shield' });
    });

    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(events);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/assets/:id/health
router.get('/:id/health', authenticate, async (req, res) => {
  try {
    const asset = await query('SELECT * FROM assets WHERE id = $1 AND org_id = $2', [req.params.id, req.user.org_id]);
    if (!asset.rows[0]) return res.status(404).json({ error: 'Asset not found' });
    const maintenance = await query('SELECT * FROM maintenance_requests WHERE asset_id = $1', [req.params.id]);
    const score = await computeHealthScore(asset.rows[0], maintenance.rows);
    // Update stored health score
    await query('UPDATE assets SET health_score = $1 WHERE id = $2', [score.score, req.params.id]);
    res.json(score);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/assets/:id/qr
router.get('/:id/qr', authenticate, async (req, res) => {
  try {
    const asset = await query('SELECT tag, name FROM assets WHERE id = $1 AND org_id = $2', [req.params.id, req.user.org_id]);
    if (!asset.rows[0]) return res.status(404).json({ error: 'Asset not found' });
    const qrData = await generateQR({ assetId: req.params.id, tag: asset.rows[0].tag, name: asset.rows[0].name });
    res.json({ qr: qrData, tag: asset.rows[0].tag });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/assets
router.post('/', authenticate, requireManager, async (req, res) => {
  const { name, category_id, serial_number, model, manufacturer, purchase_date, purchase_cost,
          warranty_start, warranty_end, location, dept_id, condition, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Asset name required' });
  try {
    // Auto-generate tag AF-XXXX
    const countResult = await query('SELECT COUNT(*) FROM assets WHERE org_id = $1', [req.user.org_id]);
    const count = parseInt(countResult.rows[0].count) + 1;
    const tag = `AF-${String(count).padStart(4, '0')}`;

    const result = await query(
      `INSERT INTO assets (org_id, tag, name, category_id, serial_number, model, manufacturer,
         purchase_date, purchase_cost, warranty_start, warranty_end, location, dept_id, condition, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [req.user.org_id, tag, name, category_id, serial_number, model, manufacturer,
       purchase_date, purchase_cost, warranty_start, warranty_end, location, dept_id, condition || 'good', notes, req.user.id]
    );

    const asset = result.rows[0];

    // Generate and store QR code
    const qrData = await generateQR({ assetId: asset.id, tag: asset.tag, name: asset.name });
    await query('UPDATE assets SET qr_code_data = $1 WHERE id = $2', [qrData, asset.id]);
    asset.qr_code_data = qrData;

    // Compute initial health score
    const health = await computeHealthScore(asset, []);
    await query('UPDATE assets SET health_score = $1 WHERE id = $2', [health.score, asset.id]);
    asset.health_score = health.score;

    // Auto-schedule audit (+15 days)
    const auditDate = new Date();
    auditDate.setDate(auditDate.getDate() + 15);
    const auditRes = await query(
      `INSERT INTO audits (org_id, dept_id, name, start_date, end_date, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.user.org_id, dept_id, `Initial Audit: ${tag}`, auditDate.toISOString().split('T')[0], auditDate.toISOString().split('T')[0], 'Auto-scheduled audit for new asset', req.user.id]
    );
    await query('INSERT INTO audit_items (audit_id, asset_id, expected_location) VALUES ($1,$2,$3)', [auditRes.rows[0].id, asset.id, location]);

    await logActivity(req.user, 'asset.registered', 'asset', asset.id, `Registered asset ${tag} - ${name}`);

    // Broadcast to org room
    const io = req.app.get('io');
    io.to(`org:${req.user.org_id}`).emit('asset:created', asset);

    res.status(201).json(asset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/assets/:id
router.patch('/:id', authenticate, requireManager, async (req, res) => {
  const { name, category_id, serial_number, model, manufacturer, purchase_date, purchase_cost,
          warranty_start, warranty_end, location, dept_id, status, condition, notes } = req.body;
  try {
    const result = await query(
      `UPDATE assets SET
         name = COALESCE($1, name), category_id = COALESCE($2, category_id),
         serial_number = COALESCE($3, serial_number), model = COALESCE($4, model),
         manufacturer = COALESCE($5, manufacturer), purchase_date = COALESCE($6, purchase_date),
         purchase_cost = COALESCE($7, purchase_cost), warranty_start = COALESCE($8, warranty_start),
         warranty_end = COALESCE($9, warranty_end), location = COALESCE($10, location),
         dept_id = COALESCE($11, dept_id), status = COALESCE($12, status),
         condition = COALESCE($13, condition), notes = COALESCE($14, notes)
       WHERE id = $15 AND org_id = $16 RETURNING *`,
      [name, category_id, serial_number, model, manufacturer, purchase_date, purchase_cost,
       warranty_start, warranty_end, location, dept_id, status, condition, notes, req.params.id, req.user.org_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Asset not found' });
    await logActivity(req.user, 'asset.updated', 'asset', result.rows[0].id, `Updated asset ${result.rows[0].tag}`);
    const io = req.app.get('io');
    io.to(`org:${req.user.org_id}`).emit('asset:updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/assets/:id  (soft delete - retire)
router.delete('/:id', authenticate, requireManager, async (req, res) => {
  try {
    await query('UPDATE assets SET status = $1 WHERE id = $2 AND org_id = $3', ['retired', req.params.id, req.user.org_id]);
    await logActivity(req.user, 'asset.retired', 'asset', req.params.id, `Asset retired`);
    res.json({ message: 'Asset retired' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
