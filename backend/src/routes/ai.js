const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { chatWithAI, generateRecommendations } = require('../services/aiEngine');
const { query } = require('../config/db');
const { computeHealthScore } = require('../services/healthScore');

// POST /api/ai/chat
router.post('/chat', authenticate, async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  try {
    const result = await chatWithAI(req.user.org_id, message, history);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/ai/predictions
router.get('/predictions', authenticate, async (req, res) => {
  try {
    const assets = await query(
      `SELECT a.* FROM assets a WHERE a.org_id = $1 AND a.status != 'retired' AND a.health_score < 80`, [req.user.org_id]
    );
    const predictions = [];
    for (const asset of assets.rows.slice(0, 15)) {
      const maint = await query('SELECT * FROM maintenance_requests WHERE asset_id = $1 ORDER BY created_at DESC', [asset.id]);
      const health = await computeHealthScore(asset, maint.rows);
      if (health.predictiveMaintenance?.dueSoon) {
        predictions.push({
          assetId: asset.id, tag: asset.tag, name: asset.name, location: asset.location,
          healthScore: health.score, healthLabel: health.label,
          prediction: health.predictiveMaintenance,
        });
      }
    }
    predictions.sort((a, b) => a.healthScore - b.healthScore);
    res.json(predictions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/ai/recommendations
router.get('/recommendations', authenticate, async (req, res) => {
  try {
    const recs = await generateRecommendations(req.user.org_id);
    res.json(recs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/ai/risks
router.get('/risks', authenticate, async (req, res) => {
  try {
    const [longHolders, excessiveMaint, repeated] = await Promise.all([
      query(`SELECT a.tag, a.name, e.name as holder, al.allocated_at,
              EXTRACT(DAYS FROM NOW() - al.allocated_at) as days_held
             FROM allocations al JOIN assets a ON al.asset_id = a.id JOIN employees e ON al.employee_id = e.id
             WHERE a.org_id = $1 AND al.status = 'active' AND al.allocated_at < NOW() - INTERVAL '180 days'`, [req.user.org_id]),
      query(`SELECT a.tag, a.name, COUNT(mr.id) as repair_count
             FROM maintenance_requests mr JOIN assets a ON mr.asset_id = a.id
             WHERE a.org_id = $1 AND mr.created_at > NOW() - INTERVAL '1 year'
             GROUP BY a.id HAVING COUNT(mr.id) > 5`, [req.user.org_id]),
    ]);
    res.json({
      longHolders: longHolders.rows,
      excessiveMaintenance: excessiveMaint.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
