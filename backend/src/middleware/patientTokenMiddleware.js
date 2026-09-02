const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/environment');
const { errorResponse } = require('../utils/response');
const MESSAGES = require('../constants/messages');

const protectPatient = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      if (decoded.role !== 'Patient' || !decoded.phone) {
        return errorResponse(res, 'Invalid patient access token', 401);
      }

      req.patientPhone = decoded.phone;
      return next();
    } catch (error) {
      console.error('Patient Token Verification Error:', error.message);
      return errorResponse(res, 'Patient session expired or invalid', 401);
    }
  }

  return errorResponse(res, MESSAGES.AUTH.UNAUTHORIZED, 401);
};

module.exports = { protectPatient };
