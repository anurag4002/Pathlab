const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/environment');
const { errorResponse } = require('../utils/response');
const MESSAGES = require('../constants/messages');
const Patient = require('../models/Patient');

const protectPatient = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      // Verify that this is a patient token
      if (decoded.role !== 'PATIENT') {
         return errorResponse(res, MESSAGES.AUTH.UNAUTHORIZED, 403);
      }

      req.patient = await Patient.findById(decoded.id);

      if (!req.patient) {
        return errorResponse(res, MESSAGES.AUTH.UNAUTHORIZED, 401);
      }

      next();
    } catch (error) {
      console.error(error);
      return errorResponse(res, MESSAGES.AUTH.UNAUTHORIZED, 401);
    }
  } else {
    return errorResponse(res, MESSAGES.AUTH.UNAUTHORIZED, 401);
  }
};

module.exports = { protectPatient };
