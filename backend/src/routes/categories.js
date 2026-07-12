const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate, requireManager } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT ac.*, COUNT(a.id) as asset_count
       FROM asset_categories ac
       LEFT JOIN assets a ON a.category_id = ac.id
       WHERE ac.org_id = $1
       GROUP BY ac.id ORDER BY ac.name`,
      [req.user.org_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, requireManager, async (req, res) => {
  const { name, description, icon, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name required' });
  try {
    const result = await query(
      'INSERT INTO asset_categories (org_id, name, description, icon, color) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.org_id, name, description, icon || 'box', color || '#6C63FF']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', authenticate, requireManager, async (req, res) => {
  const { name, description, icon, color } = req.body;
  try {
    const result = await query(
      `UPDATE asset_categories SET
         name = COALESCE($1, name), description = COALESCE($2, description),
         icon = COALESCE($3, icon), color = COALESCE($4, color)
       WHERE id = $5 AND org_id = $6 RETURNING *`,
      [name, description, icon, color, req.params.id, req.user.org_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, requireManager, async (req, res) => {
  try {
    await query('DELETE FROM asset_categories WHERE id = $1 AND org_id = $2', [req.params.id, req.user.org_id]);
    res.json({ message: 'Category deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
