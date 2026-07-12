const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate, requireManager } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*, e.name as head_name, p.name as parent_name
       FROM departments d
       LEFT JOIN employees e ON d.head_employee_id = e.id
       LEFT JOIN departments p ON d.parent_dept_id = p.id
       WHERE d.org_id = $1 ORDER BY d.name`,
      [req.user.org_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, requireManager, async (req, res) => {
  const { name, head_employee_id, parent_dept_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name required' });
  try {
    const result = await query(
      `INSERT INTO departments (org_id, name, head_employee_id, parent_dept_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.org_id, name, head_employee_id || null, parent_dept_id || null]
    );
    await logActivity(req.user, 'department.created', 'department', result.rows[0].id, `Created department: ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', authenticate, requireManager, async (req, res) => {
  const { name, head_employee_id, parent_dept_id, status } = req.body;
  try {
    const result = await query(
      `UPDATE departments SET
         name = COALESCE($1, name),
         head_employee_id = COALESCE($2, head_employee_id),
         parent_dept_id = COALESCE($3, parent_dept_id),
         status = COALESCE($4, status)
       WHERE id = $5 AND org_id = $6 RETURNING *`,
      [name, head_employee_id, parent_dept_id, status, req.params.id, req.user.org_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Department not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, requireManager, async (req, res) => {
  try {
    await query('UPDATE departments SET status = $1 WHERE id = $2 AND org_id = $3', ['inactive', req.params.id, req.user.org_id]);
    res.json({ message: 'Department deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
