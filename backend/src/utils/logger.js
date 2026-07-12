const { query } = require('../config/db');

const logActivity = async (user, action, entityType, entityId, description, metadata = {}) => {
  try {
    await query(
      `INSERT INTO activity_logs (org_id, actor_id, action, entity_type, entity_id, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user?.org_id, user?.id, action, entityType, entityId, description, JSON.stringify(metadata)]
    );
  } catch (err) {
    // Non-blocking: log errors shouldn't crash the main operation
    console.error('Activity log error:', err.message);
  }
};

const createNotification = async (io, recipientId, type, priority, title, message, entityType, entityId) => {
  try {
    const result = await query(
      `INSERT INTO notifications (recipient_id, type, priority, title, message, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [recipientId, type, priority, title, message, entityType, entityId]
    );
    // Emit real-time notification via Socket.io
    if (io) {
      io.to(`user:${recipientId}`).emit('notification:new', result.rows[0]);
    }
    return result.rows[0];
  } catch (err) {
    console.error('Notification creation error:', err.message);
  }
};

module.exports = { logActivity, createNotification };
