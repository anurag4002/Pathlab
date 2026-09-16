const { errorResponse } = require('../utils/response');
const MESSAGES = require('../constants/messages');

// Granular permission check (Labsmart FR-MANAGE).
// Admin implies all permissions. Others need user.permissions[key] === true.
// Usage: requirePermission('billing'), requirePermission('finance'), ...
function requirePermission(key) {
  return (req, res, next) => {
    if (!req.user) return errorResponse(res, MESSAGES.AUTH.UNAUTHORIZED, 401);
    if (req.user.role === 'Admin') return next();
    const perms = req.user.permissions;
    const keys = perms
      ? (typeof perms.keys === 'function' ? Array.from(perms.keys()) : Object.keys(perms))
      : [];
    // No matrix configured for this user yet -> legacy role behaviour (allow).
    // Once any permission is set explicitly, the matrix is enforced.
    if (keys.length === 0) return next();
    const allowed = typeof perms.get === 'function' ? perms.get(key) : perms[key];
    if (allowed) return next();
    return errorResponse(res, MESSAGES.AUTH.FORBIDDEN, 403);
  };
}

const PERMISSION_KEYS = ['billing', 'reports', 'rates', 'finance', 'settings', 'patients', 'delivery'];

module.exports = { requirePermission, PERMISSION_KEYS };
