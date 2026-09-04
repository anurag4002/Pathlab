const app = require('../backend/src/app');
const connectDatabase = require('../backend/src/config/database');

module.exports = async (req, res) => {
  try {
    await connectDatabase();
  } catch (err) {
    console.error('Database connection error in Vercel handler:', err.message);
  }
  return app(req, res);
};
