const { query } = require('../config/db');
const { createNotification } = require('../utils/logger');

const startScheduler = (io) => {
  console.log('⏱️ Notification scheduler started (every 10 min)');
  checkAndSendAlerts(io);
  setInterval(() => checkAndSendAlerts(io), 10 * 60 * 1000);
};

const checkAndSendAlerts = async (io) => {
  try {
    // 1. Overdue asset returns
    const overdue = await query(`
      SELECT al.id, al.asset_id, al.employee_id, a.tag, a.name,
             al.expected_return, e.name as holder_name
      FROM allocations al JOIN assets a ON al.asset_id = a.id JOIN employees e ON al.employee_id = e.id
      WHERE al.status = 'active' AND al.expected_return < NOW()
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity_id = al.id AND n.type = 'overdue'
                        AND n.created_at > NOW() - INTERVAL '24 hours')
    `);

    for (const alloc of overdue.rows) {
      await createNotification(io, alloc.employee_id, 'overdue', 'high',
        `Overdue Return: ${alloc.tag}`,
        `${alloc.name} (${alloc.tag}) was due for return on ${new Date(alloc.expected_return).toLocaleDateString()}. Please return it immediately.`,
        'allocation', alloc.id
      );
    }

    // 2. Warranty expiring in 30 days
    const warrantyExpiring = await query(`
      SELECT a.id, a.tag, a.name, a.warranty_end, a.org_id,
             e.id as admin_id
      FROM assets a
      JOIN employees e ON e.org_id = a.org_id AND e.role = 'admin'
      WHERE a.warranty_end BETWEEN NOW() AND NOW() + INTERVAL '30 days'
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity_id = a.id AND n.type = 'warranty'
                        AND n.created_at > NOW() - INTERVAL '7 days')
    `);

    for (const asset of warrantyExpiring.rows) {
      const daysLeft = Math.ceil((new Date(asset.warranty_end) - new Date()) / (1000 * 60 * 60 * 24));
      await createNotification(io, asset.admin_id, 'warranty', 'medium',
        `Warranty Expiring: ${asset.tag}`,
        `${asset.name} (${asset.tag}) warranty expires in ${daysLeft} days on ${new Date(asset.warranty_end).toLocaleDateString()}.`,
        'asset', asset.id
      );
    }

    // 3. Return due tomorrow reminder
    const dueTomorrow = await query(`
      SELECT al.id, al.asset_id, al.employee_id, a.tag, a.name
      FROM allocations al JOIN assets a ON al.asset_id = a.id
      WHERE al.status = 'active'
        AND al.expected_return::date = (NOW() + INTERVAL '1 day')::date
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity_id = al.id AND n.type = 'return_reminder'
                        AND n.created_at > NOW() - INTERVAL '20 hours')
    `);

    for (const alloc of dueTomorrow.rows) {
      await createNotification(io, alloc.employee_id, 'return_reminder', 'medium',
        `Return Due Tomorrow: ${alloc.tag}`,
        `Please return ${alloc.name} (${alloc.tag}) tomorrow.`,
        'allocation', alloc.id
      );
    }

    if (overdue.rows.length + warrantyExpiring.rows.length + dueTomorrow.rows.length > 0) {
      console.log(`🔔 Sent ${overdue.rows.length} overdue, ${warrantyExpiring.rows.length} warranty, ${dueTomorrow.rows.length} reminder alerts`);
    }
  } catch (err) {
    console.error('Scheduler error:', err.message);
  }
};

module.exports = { startScheduler };
