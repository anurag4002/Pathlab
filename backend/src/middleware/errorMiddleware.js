const { errorResponse } = require('../utils/response');
const { NODE_ENV } = require('../config/environment');

const errorHandler = (err, req, res, next) => {
  console.error('Unhandled Server Error: ', err);

  const statusCode = err.statusCode || res.statusCode === 200 ? 500 : res.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return errorResponse(
    res,
    message,
    statusCode,
    NODE_ENV === 'development' ? { stack: err.stack } : null
  );
};

module.exports = errorHandler;
