const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/environment');
const User = require('../models/User');
const { getCachedUser, setCachedUser } = require('../utils/userCache');
const { errorResponse } = require('../utils/response');
const MESSAGES = require('../constants/messages');
const ROLES = require('../constants/roles');

// A referring doctor's login may only reach its own API (/api/referrer) and
// the session endpoints below. Every other route signed in with `protect`
// refuses it, so new staff routes are closed to it by default.
// req.baseUrl is the router mount that actually matched this request.
const REFERRER_ALLOWED = [
  (req) => /^\/api\/referrer$/i.test(req.baseUrl || ''),
  (req) => /^\/api\/auth$/i.test(req.baseUrl || '') && ['/me', '/logout'].includes(String(req.path || '').toLowerCase())
];
const referrerMayUse = (req) => REFERRER_ALLOWED.some((allowed) => allowed(req));

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

      req.user = getCachedUser(decoded.id);
      if (!req.user) {
        req.user = await User.findById(decoded.id).select('-password').populate('branch', 'name code status');
        if (req.user) setCachedUser(decoded.id, req.user);
      }
      if (!req.user) {
        return errorResponse(res, MESSAGES.AUTH.USER_NOT_FOUND, 404);
      }

      if (req.user.status === 'Inactive') {
        return errorResponse(res, 'User account is inactive', 403);
      }

      if (req.user.role === ROLES.REFERRER) {
        // A password reset by the lab ends sign-ins made before it.
        const changed = req.user.passwordChangedAt ? new Date(req.user.passwordChangedAt).getTime() : 0;
        // Token times are whole seconds: only a sign-in in that same second survives.
        if (changed && (!decoded.iat || decoded.iat < Math.floor(changed / 1000))) {
          return errorResponse(res, 'Your password was changed. Please sign in again.', 401);
        }
        if (!referrerMayUse(req)) {
          return errorResponse(res, 'This page is for lab staff only.', 403);
        }
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

module.exports = { protect, referrerMayUse };
