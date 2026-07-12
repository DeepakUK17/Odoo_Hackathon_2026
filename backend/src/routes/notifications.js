const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { is_read, type, priority } = req.query;
    let sql = `SELECT * FROM notifications WHERE recipient_id = $1`;
    const params = [req.user.id];
    let i = 2;
    if (is_read !== undefined) { sql += ` AND is_read = $${i++}`; params.push(is_read === 'true'); }
    if (type) { sql += ` AND type = $${i++}`; params.push(type); }
    if (priority) { sql += ` AND priority = $${i++}`; params.push(priority); }
    sql += ' ORDER BY created_at DESC LIMIT 50';
    const result = await query(sql, params);
    const unreadCount = await query('SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND is_read = false', [req.user.id]);
    res.json({ notifications: result.rows, unreadCount: parseInt(unreadCount.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE recipient_id = $1', [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
