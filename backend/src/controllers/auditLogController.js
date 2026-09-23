const Activity = require('../models/Activity');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');

// GET /api/audit-log — Admin only, append-only (no edit/delete routes exist).
// Query: actor (user name or id), action (substring), entity/module (substring
// on Activity.module), from/to (ISO dates on Activity.date), page, limit.
const listAuditLogs = async (req, res, next) => {
  try {
    const {
      actor = '',
      action = '',
      entity = '',
      module = '',
      from = '',
      to = ''
    } = req.query;
    let { page = '1', limit = '20' } = req.query;

    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const and = [];
    if (action.trim()) and.push({ action: { $regex: action.trim(), $options: 'i' } });
    // `entity` is the public param name; Activity stores it as `module`.
    const entityQ = (entity || module).trim();
    if (entityQ) and.push({ module: { $regex: entityQ, $options: 'i' } });

    const dateRange = {};
    if (from) {
      const d = new Date(from);
      if (Number.isNaN(d.getTime())) return errorResponse(res, 'Invalid `from` date', 400);
      dateRange.$gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (Number.isNaN(d.getTime())) return errorResponse(res, 'Invalid `to` date', 400);
      d.setHours(23, 59, 59, 999);
      dateRange.$lte = d;
    }
    if (Object.keys(dateRange).length) and.push({ date: dateRange });

    // Actor matches a user's name (case-insensitive), a raw user id, or falls
    // back to the description text.
    if (actor.trim()) {
      const q = actor.trim();
      const users = await User.find({ name: { $regex: q, $options: 'i' } }).select('_id');
      const ids = users.map((u) => u._id);
      // A raw ObjectId actor filters that user exactly.
      if (/^[a-fA-F0-9]{24}$/.test(q)) ids.push(q);
      and.push({ $or: [{ user: { $in: ids } }, { description: { $regex: q, $options: 'i' } }] });
    }

    const filter = and.length ? { $and: and } : {};

    const total = await Activity.countDocuments(filter);
    const logs = await Activity.find(filter)
      .populate('user', 'name role')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return successResponse(res, 'Audit log loaded', {
      logs,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listAuditLogs };
