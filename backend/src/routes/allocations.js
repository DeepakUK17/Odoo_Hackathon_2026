const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate, requireManager } = require('../middleware/auth');
const { logActivity, createNotification } = require('../utils/logger');

// GET /api/allocations
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, asset_id, employee_id } = req.query;
    let sql = `
      SELECT al.*, a.tag, a.name as asset_name, a.status as asset_status,
             e.name as employee_name, e.email as employee_email,
             d.name as dept_name, ab.name as allocated_by_name
      FROM allocations al
      JOIN assets a ON al.asset_id = a.id
      JOIN employees e ON al.employee_id = e.id
      LEFT JOIN departments d ON al.dept_id = d.id
      LEFT JOIN employees ab ON al.allocated_by = ab.id
      WHERE a.org_id = $1
    `;
    const params = [req.user.org_id];
    let i = 2;
    if (status) { sql += ` AND al.status = $${i++}`; params.push(status); }
    if (asset_id) { sql += ` AND al.asset_id = $${i++}`; params.push(asset_id); }
    if (employee_id) { sql += ` AND al.employee_id = $${i++}`; params.push(employee_id); }
    sql += ' ORDER BY al.allocated_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/allocations (allocate asset)
router.post('/', authenticate, requireManager, async (req, res) => {
  const { asset_id, employee_id, expected_return, notes } = req.body;
  if (!asset_id || !employee_id) return res.status(400).json({ error: 'Asset and employee required' });
  try {
    // Check asset status
    const asset = await query('SELECT * FROM assets WHERE id = $1 AND org_id = $2', [asset_id, req.user.org_id]);
    if (!asset.rows[0]) return res.status(404).json({ error: 'Asset not found' });
    if (asset.rows[0].status !== 'available') {
      const holder = await query(
        `SELECT e.name, e.id FROM allocations al JOIN employees e ON al.employee_id = e.id
         WHERE al.asset_id = $1 AND al.status = 'active'`, [asset_id]
      );
      return res.status(409).json({
        error: 'Asset already allocated',
        currentHolder: holder.rows[0] || null,
        message: 'Submit a transfer request to reallocate this asset'
      });
    }

    // Get employee dept
    const emp = await query('SELECT dept_id FROM employees WHERE id = $1', [employee_id]);
    const deptId = emp.rows[0]?.dept_id;

    const result = await query(
      `INSERT INTO allocations (asset_id, employee_id, dept_id, allocated_by, expected_return, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [asset_id, employee_id, deptId, req.user.id, expected_return || null, notes]
    );

    // Update asset status
    await query('UPDATE assets SET status = $1 WHERE id = $2', ['allocated', asset_id]);

    const io = req.app.get('io');
    await logActivity(req.user, 'asset.allocated', 'asset', asset_id, `Allocated ${asset.rows[0].tag} to employee ${employee_id}`);
    await createNotification(io, employee_id, 'allocation', 'medium', 'Asset Allocated to You',
      `${asset.rows[0].name} (${asset.rows[0].tag}) has been allocated to you.`, 'asset', asset_id);
    io.to(`org:${req.user.org_id}`).emit('asset:allocated', { assetId: asset_id, employeeId: employee_id });

    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/allocations/:id/return
router.patch('/:id/return', authenticate, requireManager, async (req, res) => {
  const { return_condition, notes } = req.body;
  try {
    const alloc = await query(
      `SELECT al.*, a.tag, a.name FROM allocations al JOIN assets a ON al.asset_id = a.id WHERE al.id = $1`,
      [req.params.id]
    );
    if (!alloc.rows[0]) return res.status(404).json({ error: 'Allocation not found' });

    await query(
      `UPDATE allocations SET status = 'returned', returned_at = NOW(), return_condition = $1, notes = COALESCE($2, notes)
       WHERE id = $3`,
      [return_condition || 'good', notes, req.params.id]
    );
    await query('UPDATE assets SET status = $1, condition = COALESCE($2, condition) WHERE id = $3',
      ['available', return_condition, alloc.rows[0].asset_id]);

    await logActivity(req.user, 'asset.returned', 'asset', alloc.rows[0].asset_id, `${alloc.rows[0].tag} returned in ${return_condition || 'good'} condition`);
    const io = req.app.get('io');
    io.to(`org:${req.user.org_id}`).emit('asset:returned', { assetId: alloc.rows[0].asset_id });
    res.json({ message: 'Asset returned successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
