const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ assets: [], employees: [], departments: [] });
  try {
    const orgId = req.user.org_id;
    const term = `%${q}%`;
    const [assets, employees, departments] = await Promise.all([
      query(`SELECT id, tag, name, status, location, health_score FROM assets
             WHERE org_id = $1 AND (name ILIKE $2 OR tag ILIKE $2 OR serial_number ILIKE $2 OR location ILIKE $2) LIMIT 10`, [orgId, term]),
      query(`SELECT id, name, email, role, dept_id FROM employees
             WHERE org_id = $1 AND (name ILIKE $2 OR email ILIKE $2) AND status = 'active' LIMIT 10`, [orgId, term]),
      query(`SELECT id, name, status FROM departments WHERE org_id = $1 AND name ILIKE $2 LIMIT 5`, [orgId, term]),
    ]);
    res.json({ assets: assets.rows, employees: employees.rows, departments: departments.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
