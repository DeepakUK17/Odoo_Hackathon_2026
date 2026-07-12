const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, orgName } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  try {
    // Check existing user
    const existing = await query('SELECT id FROM employees WHERE email = $1', [email]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create org if orgName provided (first user becomes admin)
    let orgId;
    let role = 'employee';
    if (orgName) {
      const orgResult = await query(
        'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
        [orgName]
      );
      orgId = orgResult.rows[0].id;
      role = 'admin';
    } else {
      // Join default org (for demo: org 1)
      orgId = 1;
    }

    const empResult = await query(
      `INSERT INTO employees (org_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, org_id`,
      [orgId, name, email, passwordHash, role]
    );

    const user = empResult.rows[0];
    const token = jwt.sign(
      { userId: user.id, orgId: user.org_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ token, user: { ...user, password_hash: undefined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const result = await query(
      `SELECT e.*, d.name as dept_name, o.name as org_name
       FROM employees e
       LEFT JOIN departments d ON e.dept_id = d.id
       LEFT JOIN organizations o ON e.org_id = o.id
       WHERE e.email = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.status === 'inactive') return res.status(401).json({ error: 'Account is inactive' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { userId: user.id, orgId: user.org_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT e.id, e.name, e.email, e.role, e.org_id, e.dept_id, e.status, e.created_at,
              d.name as dept_name, o.name as org_name
       FROM employees e
       LEFT JOIN departments d ON e.dept_id = d.id
       LEFT JOIN organizations o ON e.org_id = o.id
       WHERE e.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
