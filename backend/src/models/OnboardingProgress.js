const mongoose = require('mongoose');

const OnboardingProgressSchema = new mongoose.Schema({
  // Single doc per lab.
  key: { type: String, unique: true, default: 'default' },
  // stepKey -> true when done. 11 Labsmart checklist steps live in constants.
  steps: { type: Map, of: Boolean, default: {} },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('OnboardingProgress', OnboardingProgressSchema);
