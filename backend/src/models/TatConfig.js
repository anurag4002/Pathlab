const mongoose = require('mongoose');

// Lab-wide TAT defaults + urgency thresholds (single-doc pattern, key='default').
// Frontend keeps a localStorage fallback (key `ppl.tatConfig`); when a server
// doc exists it overrides the local values. Per-test `tatHours` on the Test
// model still wins over `defaultTatHours` for individual tests.
const TatConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true, index: true },
  defaultTatHours: { type: Number, default: 24 },
  emergencyTatHours: { type: Number, default: 4 },
  dueSoonHours: { type: Number, default: 2 },
  urgentHours: { type: Number, default: 6 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('TatConfig', TatConfigSchema);
