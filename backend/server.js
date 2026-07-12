require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/employees', require('./src/routes/employees'));
app.use('/api/departments', require('./src/routes/departments'));
app.use('/api/categories', require('./src/routes/categories'));
app.use('/api/assets', require('./src/routes/assets'));
app.use('/api/allocations', require('./src/routes/allocations'));
app.use('/api/transfers', require('./src/routes/transfers'));
app.use('/api/resources', require('./src/routes/resources'));
app.use('/api/bookings', require('./src/routes/bookings'));
app.use('/api/maintenance', require('./src/routes/maintenance'));
app.use('/api/audits', require('./src/routes/audits'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/activity-logs', require('./src/routes/activityLogs'));
app.use('/api/search', require('./src/routes/search'));
app.use('/api/ai', require('./src/routes/ai'));
app.use('/api/export', require('./src/routes/export'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'AssetFlow API' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('join:org', (orgId) => {
    socket.join(`org:${orgId}`);
    console.log(`Socket ${socket.id} joined org:${orgId}`);
  });

  socket.on('join:user', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`Socket ${socket.id} joined user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Start notification scheduler
const { startScheduler } = require('./src/services/notificationScheduler');

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`\n🚀 AssetFlow Backend running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api\n`);

  // Start background scheduler (check every 10 min for alerts)
  startScheduler(io);
});

module.exports = { app, server, io };
