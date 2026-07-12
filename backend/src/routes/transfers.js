const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate, requireManager } = require('../middleware/auth');
const { logActivity, createNotification } = require('../utils/logger');

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT tr.*, a.tag, a.name as asset_name,
              fe.name as from_name, te.name as to_name, re.name as requested_by_name
       FROM transfer_requests tr
       JOIN assets a ON tr.asset_id = a.id
       LEFT JOIN employees fe ON tr.from_employee_id = fe.id
       JOIN employees te ON tr.to_employee_id = te.id
       LEFT JOIN employees re ON tr.requested_by = re.id
       WHERE a.org_id = $1 ORDER BY tr.created_at DESC`,
      [req.user.org_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  const { asset_id, to_employee_id, reason } = req.body;
  if (!asset_id || !to_employee_id) return res.status(400).json({ error: 'Asset and target employee required' });
  try {
    const currentAlloc = await query(
      'SELECT employee_id FROM allocations WHERE asset_id = $1 AND status = $2', [asset_id, 'active']
    );
    const result = await query(
      `INSERT INTO transfer_requests (asset_id, from_employee_id, to_employee_id, requested_by, reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [asset_id, currentAlloc.rows[0]?.employee_id || null, to_employee_id, req.user.id, reason]
    );
    const io = req.app.get('io');
    await logActivity(req.user, 'transfer.requested', 'asset', asset_id, `Transfer requested for asset ${asset_id}`);
    // Notify all managers
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/approve', authenticate, requireManager, async (req, res) => {
  try {
    const tr = await query(
      'SELECT * FROM transfer_requests WHERE id = $1', [req.params.id]
    );
    if (!tr.rows[0]) return res.status(404).json({ error: 'Transfer request not found' });
    const t = tr.rows[0];

    // Return existing allocation
    if (t.from_employee_id) {
      await query(`UPDATE allocations SET status = 'returned', returned_at = NOW() WHERE asset_id = $1 AND status = 'active'`, [t.asset_id]);
    }

    // Create new allocation
    const emp = await query('SELECT dept_id FROM employees WHERE id = $1', [t.to_employee_id]);
    await query(
      `INSERT INTO allocations (asset_id, employee_id, dept_id, allocated_by) VALUES ($1,$2,$3,$4)`,
      [t.asset_id, t.to_employee_id, emp.rows[0]?.dept_id, req.user.id]
    );
    await query('UPDATE assets SET status = $1 WHERE id = $2', ['allocated', t.asset_id]);
    await query(
      `UPDATE transfer_requests SET status = 'approved', approved_by = $1, resolved_at = NOW() WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    const io = req.app.get('io');
    await createNotification(io, t.to_employee_id, 'transfer', 'high', 'Transfer Approved', `Asset transfer has been approved and allocated to you.`, 'asset', t.asset_id);
    io.to(`org:${req.user.org_id}`).emit('transfer:approved', { assetId: t.asset_id });
    await logActivity(req.user, 'transfer.approved', 'asset', t.asset_id, `Transfer approved for asset ${t.asset_id}`);
    res.json({ message: 'Transfer approved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/reject', authenticate, requireManager, async (req, res) => {
  const { admin_notes } = req.body;
  try {
    await query(
      `UPDATE transfer_requests SET status = 'rejected', approved_by = $1, admin_notes = $2, resolved_at = NOW() WHERE id = $3`,
      [req.user.id, admin_notes, req.params.id]
    );
    res.json({ message: 'Transfer rejected' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
