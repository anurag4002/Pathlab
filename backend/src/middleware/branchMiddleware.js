const mongoose = require('mongoose');

/**
 * Multi-branch isolation.
 * - Admin (role === 'Admin') sees ALL branches. Optional ?branch=<id> filters to one.
 * - Employee / Doctor see ONLY their own branch (req.user.branch).
 * - Patient portal (protectPatient) and public QR routes NEVER use this middleware,
 *   so customers see all their records irrespective of branch.
 */

const isAdmin = (user) => user && user.role === 'Admin';

const getUserBranchId = (user) => {
  if (!user || !user.branch) return null;
  // populated doc, ObjectId, or legacy string
  if (typeof user.branch === 'object' && user.branch._id) return String(user.branch._id);
  return String(user.branch);
};

/**
 * Build a mongoose filter fragment for branch isolation.
 * @param {Object} req express request (needs req.user)
 * @param {String} field model field name holding the branch ref (default 'branch')
 * @returns {Object} {} for admin (all), or { [field]: branchId } for staff.
 * Admin may pass ?branch=<branchId> to narrow to one branch.
 */
function getBranchFilter(req, field = 'branch') {
  const user = req.user;
  if (!user) return {};
  if (isAdmin(user)) {
    const q = req.query && (req.query.branch || req.query.branchId);
    if (q && mongoose.Types.ObjectId.isValid(String(q))) {
      return { [field]: String(q) };
    }
    return {};
  }
  const bid = getUserBranchId(user);
  if (!bid) return {};
  if (mongoose.Types.ObjectId.isValid(bid)) {
    return { [field]: bid };
  }
  // Legacy string branch (pre-migration): match legacy text fields via caller.
  // Return a marker so callers can also filter legacy centre fields.
  return { [field]: bid };
}

/**
 * Resolve which branch a newly created doc should belong to.
 * - Staff: always their own branch (ignore client-supplied value).
 * - Admin: client-supplied branch (body.branch / body.branchId) if valid, else own branch.
 * @returns {String|ObjectId|null}
 */
function resolveBranchForCreate(req, body = {}) {
  const user = req.user;
  if (!user) return body.branch || body.branchId || null;
  if (!isAdmin(user)) {
    return user.branch && (user.branch._id || user.branch) ? (user.branch._id || user.branch) : null;
  }
  const supplied = body.branch || body.branchId;
  if (supplied && mongoose.Types.ObjectId.isValid(String(supplied))) return String(supplied);
  if (supplied && typeof supplied === 'string' && supplied.trim()) return supplied.trim();
  return user.branch && (user.branch._id || user.branch) ? (user.branch._id || user.branch) : null;
}

/**
 * Check whether req.user may access a doc belonging to docBranch.
 * Legacy docs with no branch are treated as visible (pre-migration open),
 * new docs are strictly isolated.
 */
function canAccessBranch(req, docBranch) {
  if (isAdmin(req.user)) return true;
  if (!docBranch) return true; // legacy record, allow during migration window
  const mine = getUserBranchId(req.user);
  if (!mine) return false;
  const docId = (docBranch && docBranch._id) ? String(docBranch._id) : String(docBranch);
  return docId === String(mine);
}

function assertBranchAccess(req, docBranch) {
  if (canAccessBranch(req, docBranch)) return;
  const err = new Error('Access denied for this branch');
  err.statusCode = 403;
  throw err;
}

module.exports = {
  isAdmin,
  getUserBranchId,
  getBranchFilter,
  resolveBranchForCreate,
  canAccessBranch,
  assertBranchAccess
};
