let app;
let initError = null;

try {
  app = require('../backend/src/app');
} catch (e) {
  initError = e;
  console.error('Failed to load backend app:', e);
}

const isDev = process.env.NODE_ENV !== 'production';

module.exports = (req, res) => {
  if (initError) {
    return res.status(500).json({
      error: 'Backend initialization error',
      message: isDev ? initError.message : 'Service temporarily unavailable',
      ...(isDev ? { stack: initError.stack } : {})
    });
  }
  try {
    return app(req, res);
  } catch (err) {
    console.error('Serverless runtime error:', err);
    return res.status(500).json({
      error: 'Runtime execution error',
      message: isDev ? err.message : 'Service temporarily unavailable',
      ...(isDev ? { stack: err.stack } : {})
    });
  }
};
