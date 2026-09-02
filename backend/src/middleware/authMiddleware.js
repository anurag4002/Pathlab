const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/environment');
const User = require('../models/User');
const { errorResponse } = require('../utils/response');
const MESSAGES = require('../constants/messages');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      if (decoded.role === 'Patient' || !decoded.id) {
        return errorResponse(res, 'Access denied. Administrator privileges required.', 403);
      }

      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return errorResponse(res, MESSAGES.AUTH.USER_NOT_FOUND, 404);
      }

      if (req.user.status === 'Inactive') {
        return errorResponse(res, 'User account is inactive', 403);
      }

      next();
    } catch (error) {
      console.error('JWT Token Verification Error', error);
      return errorResponse(res, MESSAGES.AUTH.UNAUTHORIZED, 401);
    }
  }

  if (!token) {
    return errorResponse(res, MESSAGES.AUTH.UNAUTHORIZED, 401);
  }
};

module.exports = { protect };
