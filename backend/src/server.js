const app = require('./app');
const connectDatabase = require('./config/database');
const { PORT } = require('./config/environment');

// Connect to MongoDB
connectDatabase().catch(err => {
  console.error('Initial database connection warning:', err.message);
});

// Start Server when executed directly locally (not in serverless)
if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`Pure Path Lab Backend Server running on port ${PORT}`);
  });

  process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection Error: ${err.message}`);
  });
}

module.exports = app;
