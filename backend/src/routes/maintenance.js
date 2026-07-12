const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate, requireManager } = require('../middleware/auth');
const { logActivity, createNotification } = require('../utils/logger');

const VALID_STATUSES = ['pending', 'approved', 'assigned', 'in_progress', 'resolved', 'cancelled'];

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, asset_id, priority } = req.query;
    let sql = `
      SELECT mr.*, a.tag, a.name as asset_name, a.location,
             re.name as raised_by_name, as2.name as assigned_to_name
      FROM maintenance_requests mr
      JOIN assets a ON mr.asset_id = a.id
      LEFT JOIN employees re ON mr.raised_by = re.id
      LEFT JOIN employees as2 ON mr.assigned_to = as2.id
      WHERE a.org_id = $1
    `;
    const params = [req.user.org_id];
    let i = 2;
    if (status) { sql += ` AND mr.status = $${i++}`; params.push(status); }
    if (asset_id) { sql += ` AND mr.asset_id = $${i++}`; params.push(asset_id); }
    if (priority) { sql += ` AND mr.priority = $${i++}`; params.push(priority); }
    sql += ' ORDER BY CASE mr.priority WHEN \'critical\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, mr.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  const { asset_id, title, description, priority } = req.body;
  if (!asset_id || !title) return res.status(400).json({ error: 'Asset and title required' });
  try {
    const result = await query(
      `INSERT INTO maintenance_requests (asset_id, raised_by, title, description, priority)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [asset_id, req.user.id, title, description, priority || 'medium']
    );
    await logActivity(req.user, 'maintenance.raised', 'maintenance', result.rows[0].id, `Maintenance raised for asset ${asset_id}: ${title}`);
    const io = req.app.get('io');
    io.to(`org:${req.user.org_id}`).emit('maintenance:new', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', authenticate, requireManager, async (req, res) => {
  const { title, description, priority, status, assigned_to, estimated_cost, actual_cost, resolution_notes } = req.body;
  try {
    // If status is provided, validate it
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Use: ${VALID_STATUSES.join(', ')}` });
    }

    const result = await query(
      `UPDATE maintenance_requests SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        priority = COALESCE($3, priority),
        status = COALESCE($4, status),
        assigned_to = COALESCE($5, assigned_to),
        estimated_cost = COALESCE($6, estimated_cost),
        actual_cost = COALESCE($7, actual_cost),
        resolution_notes = COALESCE($8, resolution_notes),
        resolved_at = CASE WHEN $4 = 'resolved' THEN NOW() ELSE resolved_at END,
        updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [
        title || null, description || null, priority || null,
        status || null, assigned_to || null, estimated_cost || null,
        actual_cost || null, resolution_notes || null, req.params.id
      ]
    );


    if (!result.rows[0]) return res.status(404).json({ error: 'Maintenance request not found' });

    // Update asset status based on maintenance status
    const mr = result.rows[0];
    if (status === 'approved' || status === 'in_progress') {
      await query('UPDATE assets SET status = $1 WHERE id = $2', ['maintenance', mr.asset_id]);
    } else if (status === 'resolved') {
      await query('UPDATE assets SET status = $1 WHERE id = $2', ['available', mr.asset_id]);
    }

    const io = req.app.get('io');
    io.to(`org:${req.user.org_id}`).emit('maintenance:updated', result.rows[0]);
    await logActivity(req.user, `maintenance.${status}`, 'maintenance', mr.id, `Maintenance ${status}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
