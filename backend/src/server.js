const app = require('./app');
const connectDatabase = require('./config/database');
const { PORT } = require('./config/environment');

// Connect to MongoDB
connectDatabase();

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Pure Path Lab Backend Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
