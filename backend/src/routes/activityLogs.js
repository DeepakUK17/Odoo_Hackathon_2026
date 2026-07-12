const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { entity_type, limit = 50 } = req.query;
    let sql = `
      SELECT al.*, e.name as actor_name, e.email as actor_email, e.role as actor_role
      FROM activity_logs al LEFT JOIN employees e ON al.actor_id = e.id
      WHERE al.org_id = $1
    `;
    const params = [req.user.org_id];
    if (entity_type) { sql += ` AND al.entity_type = $2`; params.push(entity_type); }
    sql += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
