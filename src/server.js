require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const scheduler = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Mount API routes
app.use('/api', apiRoutes);

// Fallback to index.html for root navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server
const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Cookie Refresher Service berjalan di port ${PORT}`);
  console.log(`🌐 Dashboard UI: http://localhost:${PORT}`);
  console.log(`🍪 API Cookies:  http://localhost:${PORT}/api/cookies`);
  console.log(`🧪 API Test:     http://localhost:${PORT}/api/test`);
  console.log(`🔄 Target URL:   ${process.env.TARGET_URL || 'https://vhjgakh.com'}`);
  console.log(`⏰ Interval:     ${process.env.REFRESH_INTERVAL_MINUTES || 30} menit`);
  console.log('====================================================');

  // Start background auto-refresh scheduler
  scheduler.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down server...');
  scheduler.stop();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Shutting down server...');
  scheduler.stop();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
