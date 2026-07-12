const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate, requireManager } = require('../middleware/auth');
const { logActivity, createNotification } = require('../utils/logger');

// Resources CRUD
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM resources WHERE org_id = $1 ORDER BY name', [req.user.org_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, requireManager, async (req, res) => {
  const { name, type, location, capacity, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Resource name required' });
  try {
    const result = await query(
      'INSERT INTO resources (org_id, name, type, location, capacity, description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.user.org_id, name, type || 'room', location, capacity, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', authenticate, requireManager, async (req, res) => {
  const { name, type, location, capacity, description, status } = req.body;
  try {
    const result = await query(
      `UPDATE resources SET name=COALESCE($1,name), type=COALESCE($2,type), location=COALESCE($3,location),
       capacity=COALESCE($4,capacity), description=COALESCE($5,description), status=COALESCE($6,status)
       WHERE id=$7 AND org_id=$8 RETURNING *`,
      [name, type, location, capacity, description, status, req.params.id, req.user.org_id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
