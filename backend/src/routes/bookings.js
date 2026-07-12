const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { logActivity, createNotification } = require('../utils/logger');

// GET /api/bookings
router.get('/', authenticate, async (req, res) => {
  try {
    const { resource_id, date, employee_id } = req.query;
    let sql = `
      SELECT b.*, r.name as resource_name, r.type as resource_type, r.location,
             e.name as booked_by_name, e.email as booked_by_email
      FROM bookings b
      JOIN resources r ON b.resource_id = r.id
      JOIN employees e ON b.employee_id = e.id
      WHERE r.org_id = $1
    `;
    const params = [req.user.org_id];
    let i = 2;
    if (resource_id) { sql += ` AND b.resource_id = $${i++}`; params.push(resource_id); }
    if (employee_id) { sql += ` AND b.employee_id = $${i++}`; params.push(employee_id); }
    if (date) {
      sql += ` AND DATE(b.start_time) = $${i++}`;
      params.push(date);
    }
    sql += ' ORDER BY b.start_time ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/bookings
router.post('/', authenticate, async (req, res) => {
  const { resource_id, title, start_time, end_time, attendees, notes } = req.body;
  if (!resource_id || !start_time || !end_time) return res.status(400).json({ error: 'Resource, start and end time required' });
  if (new Date(end_time) <= new Date(start_time)) return res.status(400).json({ error: 'End time must be after start time' });

  try {
    // Check for conflicts
    const conflict = await query(
      `SELECT b.id, e.name as booked_by, b.start_time, b.end_time, b.title
       FROM bookings b JOIN employees e ON b.employee_id = e.id
       WHERE b.resource_id = $1 AND b.status = 'confirmed'
         AND tstzrange(b.start_time, b.end_time, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')`,
      [resource_id, start_time, end_time]
    );

    if (conflict.rows.length > 0) {
      const c = conflict.rows[0];
      return res.status(409).json({
        error: 'Time slot conflict',
        conflict: c,
        message: `Slot is already booked by ${c.booked_by} from ${new Date(c.start_time).toLocaleTimeString()} to ${new Date(c.end_time).toLocaleTimeString()}`
      });
    }

    const result = await query(
      `INSERT INTO bookings (resource_id, employee_id, title, start_time, end_time, attendees, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [resource_id, req.user.id, title, start_time, end_time, attendees || 1, notes]
    );

    const io = req.app.get('io');
    io.to(`user:${req.user.id}`).emit('booking:confirmed', result.rows[0]);
    await logActivity(req.user, 'booking.created', 'booking', result.rows[0].id, `Booked resource ${resource_id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23P01') { // Exclusion constraint violation
      return res.status(409).json({ error: 'Time slot is already booked (conflict detected)' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND employee_id = $2`, [req.params.id, req.user.id]);
    res.json({ message: 'Booking cancelled' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
