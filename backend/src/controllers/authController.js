const authService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/response');
const { validateLogin } = require('../validators/authValidator');
const MESSAGES = require('../constants/messages');
const Activity = require('../models/Activity');
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CALLBACK_URL,
  FACEBOOK_CLIENT_ID,
  FACEBOOK_CALLBACK_URL
} = require('../config/environment');

const login = async (req, res, next) => {
  try {
    const { errors, isValid } = validateLogin(req.body);
    if (!isValid) {
      return errorResponse(res, MESSAGES.GENERAL.VALIDATION_ERROR, 400, errors);
    }

    // Browser allow-list enforcement (bootstrap mode when none registered).
    const browserCheck = await authService.checkBrowserAllowed(req.body.browserCode || req.headers['x-browser-code']);
    if (!browserCheck.allowed) {
      return errorResponse(res, browserCheck.reason, 403);
    }

    const { email, password, remember } = req.body;
    const authData = await authService.login(email, password, remember === true);

    if (!authData) {
      return errorResponse(res, MESSAGES.AUTH.INVALID_CREDENTIALS, 401);
    }

    // Log Activity (with IP/UA so Browser Security shows real sessions)
    await Activity.create({
      user: authData.user._id,
      action: 'Login',
      module: 'Authentication',
      description: `User ${authData.user.name} logged in successfully.`,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || ''
    });

    return successResponse(res, MESSAGES.AUTH.LOGIN_SUCCESS, authData);
  } catch (error) {
    next(error);
  }
};

const getGoogleAuthUrl = (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return errorResponse(
      res,
      'Google OAuth is not configured on the server. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env',
      501
    );
  }

  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: GOOGLE_CALLBACK_URL || 'http://localhost:5173/admin/login',
    client_id: GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ')
  };

  const qs = new URLSearchParams(options);
  return successResponse(res, 'Google Auth URL generated', {
    url: `${rootUrl}?${qs.toString()}`
  });
};

const googleAuth = async (req, res, next) => {
  try {
    const { email, name, googleId } = req.body;
    if (!email) {
      return errorResponse(res, 'Email is required for Google authentication', 400);
    }

    const authData = await authService.googleAuth({ email, name, googleId });

    await Activity.create({
      user: authData.user._id,
      action: 'Google OAuth Login',
      module: 'Authentication',
      description: `User ${authData.user.name} logged in via Google OAuth.`
    });

    return successResponse(res, MESSAGES.AUTH.LOGIN_SUCCESS, authData);
  } catch (error) {
    next(error);
  }
};

const getFacebookAuthUrl = (req, res) => {
  if (!FACEBOOK_CLIENT_ID) {
    return errorResponse(
      res,
      'Facebook OAuth is not configured on the server. Please configure FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in backend/.env',
      501
    );
  }

  const rootUrl = 'https://www.facebook.com/v18.0/dialog/oauth';
  const options = {
    client_id: FACEBOOK_CLIENT_ID,
    redirect_uri: FACEBOOK_CALLBACK_URL || 'http://localhost:5173/admin/login',
    scope: 'email,public_profile'
  };

  const qs = new URLSearchParams(options);
  return successResponse(res, 'Facebook Auth URL generated', {
    url: `${rootUrl}?${qs.toString()}`
  });
};

const facebookAuth = async (req, res, next) => {
  try {
    const { email, name, facebookId } = req.body;
    const authData = await authService.facebookAuth({ email, name, facebookId });

    await Activity.create({
      user: authData.user._id,
      action: 'Facebook OAuth Login',
      module: 'Authentication',
      description: `User ${authData.user.name} logged in via Facebook OAuth.`
    });

    return successResponse(res, MESSAGES.AUTH.LOGIN_SUCCESS, authData);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return errorResponse(res, 'Please provide your registered email or phone number', 400);
    }

    const result = await authService.requestPasswordReset(email);
    return successResponse(res, result.message, { channel: result.channel });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return errorResponse(res, 'Email/phone, OTP and new password are required', 400);
    }
    const result = await authService.resetPasswordWithOtp(email, otp, newPassword);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

const requestEmailOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return errorResponse(res, 'Email is required', 400);
    }
    const result = await authService.requestEmailOtp(email);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

const verifyEmailOtp = async (req, res, next) => {
  try {
    const { email, otp, remember } = req.body;
    if (!email || !otp) {
      return errorResponse(res, 'Email and OTP are required', 400);
    }
    const browserCheck = await authService.checkBrowserAllowed(req.body.browserCode || req.headers['x-browser-code']);
    if (!browserCheck.allowed) {
      return errorResponse(res, browserCheck.reason, 403);
    }
    const authData = await authService.verifyEmailOtp(email, otp, remember === true);
    await Activity.create({
      user: authData.user._id,
      action: 'Email OTP Login',
      module: 'Authentication',
      description: `User ${authData.user.name} logged in via email OTP.`,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || ''
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
  getGoogleAuthUrl,
  googleAuth,
  getFacebookAuthUrl,
  facebookAuth,
  forgotPassword,
  resetPassword,
  requestEmailOtp,
  verifyEmailOtp,
  getCurrentUser,
  logout
};
