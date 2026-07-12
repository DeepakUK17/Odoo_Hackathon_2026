const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate, requireAdmin, requireManager } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const bcrypt = require('bcryptjs');

// GET /api/employees
router.get('/', authenticate, async (req, res) => {
  try {
    const { dept_id, status, role, search } = req.query;
    let sql = `
      SELECT e.id, e.name, e.email, e.role, e.status, e.dept_id, e.created_at,
             d.name as dept_name, o.name as org_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN organizations o ON e.org_id = o.id
      WHERE e.org_id = $1
    `;
    const params = [req.user.org_id];
    let i = 2;
    if (dept_id) { sql += ` AND e.dept_id = $${i++}`; params.push(dept_id); }
    if (status) { sql += ` AND e.status = $${i++}`; params.push(status); }
    if (role) { sql += ` AND e.role = $${i++}`; params.push(role); }
    if (search) { sql += ` AND (e.name ILIKE $${i} OR e.email ILIKE $${i})`; params.push(`%${search}%`); i++; }
    sql += ' ORDER BY e.name ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/employees/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, d.name as dept_name FROM employees e
       LEFT JOIN departments d ON e.dept_id = d.id
       WHERE e.id = $1 AND e.org_id = $2`,
      [req.params.id, req.user.org_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Employee not found' });
    const { password_hash, ...emp } = result.rows[0];
    res.json(emp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/employees
router.post('/', authenticate, requireManager, async (req, res) => {
  const { name, email, password, role = 'employee', dept_id, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  try {
    const existing = await query('SELECT id FROM employees WHERE email = $1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Email already exists' });
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO employees (org_id, dept_id, name, email, password_hash, role, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, email, role, dept_id, status`,
      [req.user.org_id, dept_id || null, name, email, hash, role, phone || null]
    );
    await logActivity(req.user, 'employee.created', 'employee', result.rows[0].id, `Created employee ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/employees/:id
router.patch('/:id', authenticate, requireManager, async (req, res) => {
  const { name, role, dept_id, status, phone } = req.body;
  try {
    const result = await query(
      `UPDATE employees SET
         name = COALESCE($1, name),
         role = COALESCE($2, role),
         dept_id = COALESCE($3, dept_id),
         status = COALESCE($4, status),
         phone = COALESCE($5, phone)
       WHERE id = $6 AND org_id = $7
       RETURNING id, name, email, role, dept_id, status`,
      [name, role, dept_id, status, phone, req.params.id, req.user.org_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Employee not found' });
    await logActivity(req.user, 'employee.updated', 'employee', result.rows[0].id, `Updated employee ${result.rows[0].name}`);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/employees/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await query('UPDATE employees SET status = $1 WHERE id = $2 AND org_id = $3', ['inactive', req.params.id, req.user.org_id]);
    res.json({ message: 'Employee deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
