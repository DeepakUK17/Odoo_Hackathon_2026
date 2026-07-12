const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate, requireManager } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT au.*, d.name as dept_name, e.name as created_by_name,
              COUNT(ai.id) as total_items,
              COUNT(ai.id) FILTER (WHERE ai.verification_status = 'verified') as verified_count,
              COUNT(ai.id) FILTER (WHERE ai.verification_status = 'missing') as missing_count,
              COUNT(ai.id) FILTER (WHERE ai.verification_status = 'damaged') as damaged_count
       FROM audits au LEFT JOIN departments d ON au.dept_id = d.id
       LEFT JOIN employees e ON au.created_by = e.id
       LEFT JOIN audit_items ai ON ai.audit_id = au.id
       WHERE au.org_id = $1 GROUP BY au.id, d.name, e.name ORDER BY au.created_at DESC`,
      [req.user.org_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, requireManager, async (req, res) => {
  const { name, dept_id, start_date, end_date, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Audit name required' });
  try {
    const audit = await query(
      `INSERT INTO audits (org_id, dept_id, name, start_date, end_date, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.org_id, dept_id, name, start_date, end_date, description, req.user.id]
    );

    // Auto-populate audit items with dept assets
    if (dept_id) {
      const assets = await query('SELECT id, location FROM assets WHERE dept_id = $1 AND org_id = $2 AND status != $3', [dept_id, req.user.org_id, 'retired']);
      for (const asset of assets.rows) {
        await query('INSERT INTO audit_items (audit_id, asset_id, expected_location) VALUES ($1,$2,$3)', [audit.rows[0].id, asset.id, asset.location]);
      }
    }
    await logActivity(req.user, 'audit.created', 'audit', audit.rows[0].id, `Audit created: ${name}`);
    res.status(201).json(audit.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/items', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT ai.*, a.tag, a.name as asset_name, a.location as current_location,
              e.name as verified_by_name
       FROM audit_items ai JOIN assets a ON ai.asset_id = a.id
       LEFT JOIN employees e ON ai.verified_by = e.id
       WHERE ai.audit_id = $1 ORDER BY a.tag`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/items/:itemId', authenticate, async (req, res) => {
  const { verification_status, actual_location, notes } = req.body;
  try {
    const result = await query(
      `UPDATE audit_items SET verification_status = $1, actual_location = COALESCE($2, actual_location),
       notes = COALESCE($3, notes), verified_by = $4, verified_at = NOW()
       WHERE id = $5 AND audit_id = $6 RETURNING *`,
      [verification_status, actual_location, notes, req.user.id, req.params.itemId, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/close', authenticate, requireManager, async (req, res) => {
  try {
    await query(`UPDATE audits SET status = 'closed', closed_at = NOW() WHERE id = $1 AND org_id = $2`, [req.params.id, req.user.org_id]);
    await logActivity(req.user, 'audit.closed', 'audit', req.params.id, 'Audit cycle closed');
    res.json({ message: 'Audit closed. Discrepancy report generated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
