const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { generateReportSummary } = require('../services/aiEngine');

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const [assetStats, maintenanceStats, bookingStats, recentActivity] = await Promise.all([
      query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'allocated') as allocated,
        COUNT(*) FILTER (WHERE status = 'maintenance') as in_maintenance,
        COUNT(*) FILTER (WHERE status = 'retired') as retired,
        AVG(health_score) as avg_health
        FROM assets WHERE org_id = $1`, [orgId]),
      query(`SELECT COUNT(*) FILTER (WHERE status != 'resolved' AND status != 'cancelled') as open_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count
        FROM maintenance_requests mr JOIN assets a ON mr.asset_id = a.id WHERE a.org_id = $1`, [orgId]),
      query(`SELECT COUNT(*) FILTER (WHERE status = 'confirmed' AND start_time > NOW()) as upcoming,
        COUNT(*) FILTER (WHERE status = 'confirmed' AND start_time <= NOW() AND end_time >= NOW()) as active
        FROM bookings b JOIN resources r ON b.resource_id = r.id WHERE r.org_id = $1`, [orgId]),
      query(`SELECT al.id, a.tag, a.name as asset_name, e.name as employee_name, d.name as dept_name, al.allocated_at
        FROM allocations al JOIN assets a ON al.asset_id = a.id JOIN employees e ON al.employee_id = e.id
        LEFT JOIN departments d ON al.dept_id = d.id WHERE a.org_id = $1 AND al.status = 'active'
        ORDER BY al.allocated_at DESC LIMIT 5`, [orgId]),
    ]);

    const overdueQuery = await query(
      `SELECT COUNT(*) as count FROM allocations al JOIN assets a ON al.asset_id = a.id
       WHERE a.org_id = $1 AND al.status = 'active' AND al.expected_return < NOW()`, [orgId]
    );

    const pendingTransfers = await query(
      `SELECT COUNT(*) as count FROM transfer_requests tr JOIN assets a ON tr.asset_id = a.id
       WHERE a.org_id = $1 AND tr.status = 'pending'`, [orgId]
    );

    res.json({
      assets: assetStats.rows[0],
      maintenance: maintenanceStats.rows[0],
      bookings: bookingStats.rows[0],
      overdueCount: overdueQuery.rows[0].count,
      pendingTransfers: pendingTransfers.rows[0].count,
      recentAllocations: recentActivity.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/utilization
router.get('/utilization', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.name as dept, COUNT(a.id) as total_assets,
              COUNT(a.id) FILTER (WHERE a.status = 'allocated') as allocated_assets,
              ROUND(100.0 * COUNT(a.id) FILTER (WHERE a.status = 'allocated') / NULLIF(COUNT(a.id), 0), 1) as utilization_pct
       FROM departments d LEFT JOIN assets a ON a.dept_id = d.id
       WHERE d.org_id = $1 GROUP BY d.id ORDER BY utilization_pct DESC NULLS LAST`, [req.user.org_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/maintenance-trends
router.get('/maintenance-trends', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT DATE_TRUNC('month', mr.created_at) as month, COUNT(*) as total,
              COUNT(*) FILTER (WHERE mr.status = 'resolved') as resolved
       FROM maintenance_requests mr JOIN assets a ON mr.asset_id = a.id
       WHERE a.org_id = $1 AND mr.created_at >= NOW() - INTERVAL '6 months'
       GROUP BY month ORDER BY month`, [req.user.org_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/idle-assets
router.get('/idle-assets', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.tag, a.name, a.location, a.health_score, ac.name as category,
              EXTRACT(DAYS FROM NOW() - a.created_at) as days_in_system
       FROM assets a LEFT JOIN asset_categories ac ON a.category_id = ac.id
       WHERE a.org_id = $1 AND a.status = 'available'
       ORDER BY days_in_system DESC LIMIT 20`, [req.user.org_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/summary (AI-generated)
router.get('/summary', authenticate, async (req, res) => {
  try {
    const [assets, maintenance, utilization] = await Promise.all([
      query(`SELECT COUNT(*) as total, AVG(health_score) as avg_health FROM assets WHERE org_id = $1`, [req.user.org_id]),
      query(`SELECT COUNT(*) as open FROM maintenance_requests mr JOIN assets a ON mr.asset_id = a.id WHERE a.org_id = $1 AND mr.status NOT IN ('resolved','cancelled')`, [req.user.org_id]),
      query(`SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status='allocated') / NULLIF(COUNT(*),0),1) as rate FROM assets WHERE org_id = $1`, [req.user.org_id]),
    ]);

    const reportData = {
      totalAssets: assets.rows[0].total,
      avgHealth: Math.round(assets.rows[0].avg_health || 0),
      openMaintenance: maintenance.rows[0].open,
      utilizationRate: utilization.rows[0].rate,
    };

    const summary = await generateReportSummary(reportData);
    res.json({ summary, data: reportData });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
