let app;
let initError = null;

try {
  app = require('../backend/src/app');
} catch (e) {
  initError = e;
  console.error('Failed to load backend app:', e);
}

module.exports = (req, res) => {
  if (initError) {
    return res.status(500).json({
      error: 'Backend initialization error',
      message: initError.message,
      stack: initError.stack
    });
  }
  try {
    return app(req, res);
  } catch (err) {
    return res.status(500).json({
      error: 'Runtime execution error',
      message: err.message,
      stack: err.stack
    });
  }
};
