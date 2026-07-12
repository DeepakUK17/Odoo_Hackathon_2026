const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data
    const result = await query(
      'SELECT id, name, email, role, org_id, dept_id, status FROM employees WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows[0] || result.rows[0].status === 'inactive') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired, please login again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireManager = (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager or Admin access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireManager };
