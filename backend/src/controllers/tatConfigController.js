const TatConfig = require('../models/TatConfig');
const Activity = require('../models/Activity');
const { successResponse, errorResponse } = require('../utils/response');

const DEFAULTS = {
  defaultTatHours: 24,
  emergencyTatHours: 4,
  dueSoonHours: 2,
  urgentHours: 6
};

const FIELDS = ['defaultTatHours', 'emergencyTatHours', 'dueSoonHours', 'urgentHours'];

// Positive numbers only (frontend steps by 0.5h, so decimals are allowed).
// Ordering invariant: dueSoon <= urgent <= default.
const validate = (obj) => {
  for (const key of FIELDS) {
    const n = Number(obj[key]);
    if (!Number.isFinite(n) || n <= 0) return `${key} must be a positive number of hours`;
  }
  if (Number(obj.dueSoonHours) > Number(obj.urgentHours)) {
    return 'dueSoonHours must be <= urgentHours';
  }
  if (Number(obj.urgentHours) > Number(obj.defaultTatHours)) {
    return 'urgentHours must be <= defaultTatHours';
  }
  return '';
};

const getTatConfig = async (req, res, next) => {
  try {
    let doc = await TatConfig.findOne({ key: 'default' });
    if (!doc) doc = await TatConfig.create({ key: 'default', ...DEFAULTS });
    return successResponse(res, 'TAT config loaded', doc);
  } catch (error) {
    next(error);
  }
};

const updateTatConfig = async (req, res, next) => {
  try {
    let doc = await TatConfig.findOne({ key: 'default' });
    const base = doc
      ? {
          defaultTatHours: doc.defaultTatHours,
          emergencyTatHours: doc.emergencyTatHours,
          dueSoonHours: doc.dueSoonHours,
          urgentHours: doc.urgentHours
        }
      : { ...DEFAULTS };
    const merged = { ...base };
    FIELDS.forEach((k) => {
      if (req.body[k] !== undefined) merged[k] = Number(req.body[k]);
    });
    const err = validate(merged);
    if (err) return errorResponse(res, err, 400);
    if (!doc) {
      doc = await TatConfig.create({ key: 'default', ...merged, updatedBy: req.user._id });
    } else {
      Object.assign(doc, merged, { updatedBy: req.user._id });
      await doc.save();
    }
    await Activity.create({
      user: req.user._id, action: 'Update TAT Config', module: 'Settings',
      description: `TAT defaults updated (default ${doc.defaultTatHours}h, emergency ${doc.emergencyTatHours}h, due-soon ${doc.dueSoonHours}h, urgent ${doc.urgentHours}h).`,
      ip: req.ip, userAgent: req.headers['user-agent'] || ''
    });
    return successResponse(res, 'TAT config updated', doc);
  } catch (error) {
    next(error);
  }
};

module.exports = { getTatConfig, updateTatConfig, TAT_DEFAULTS: DEFAULTS };
