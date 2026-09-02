const { errorResponse } = require('../utils/response');
const MESSAGES = require('../constants/messages');

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return errorResponse(res, MESSAGES.AUTH.FORBIDDEN, 403);
    }
    next();
  };
};

module.exports = { authorize };
