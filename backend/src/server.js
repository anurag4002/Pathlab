const app = require('./app');
const connectDatabase = require('./config/database');
const { PORT } = require('./config/environment');

// Connect to MongoDB + ensure Main branch + backfill legacy branch-less docs
connectDatabase()
  .then(async () => {
    try {
      const { backfillBranchRefs } = require('./utils/ensureBranch');
      await backfillBranchRefs();
    } catch (e) {
      console.warn('Branch bootstrap skipped:', e.message);
    }
  })
  .catch(err => {
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
