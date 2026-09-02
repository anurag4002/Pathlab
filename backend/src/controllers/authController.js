const authService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/response');
const { validateLogin } = require('../validators/authValidator');
const MESSAGES = require('../constants/messages');
const Activity = require('../models/Activity');

const login = async (req, res, next) => {
  try {
    const { errors, isValid } = validateLogin(req.body);
    if (!isValid) {
      return errorResponse(res, MESSAGES.GENERAL.VALIDATION_ERROR, 400, errors);
    }

    const { email, password } = req.body;
    const authData = await authService.login(email, password);

    if (!authData) {
      return errorResponse(res, MESSAGES.AUTH.INVALID_CREDENTIALS, 401);
    }

    // Log Activity
    await Activity.create({
      user: authData.user._id,
      action: 'Login',
      module: 'Authentication',
      description: `User ${authData.user.name} logged in successfully.`
    });

    return successResponse(res, MESSAGES.AUTH.LOGIN_SUCCESS, authData);
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(res, MESSAGES.AUTH.UNAUTHORIZED, 401);
    }
    return successResponse(res, 'User profile fetched successfully', { user: req.user });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await Activity.create({
        user: req.user._id,
        action: 'Logout',
        module: 'Authentication',
        description: `User ${req.user.name} logged out.`
      });
    }
    return successResponse(res, MESSAGES.AUTH.LOGOUT_SUCCESS);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getCurrentUser,
  logout
};
