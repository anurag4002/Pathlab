const mongoose = require('mongoose');

const TestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestCategory',
    required: true
  },
  sampleType: {
    type: String,
    required: true,
    trim: true
  },
  unit: {
    type: String,
    trim: true
  },
  referenceRange: {
    type: String,
    trim: true
  },
  maleReferenceRange: {
    type: String,
    trim: true
  },
  femaleReferenceRange: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  interpretation: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
    index: true
  },
  // Machine-readable normals for the abnormal checker + age/sex restrictions.
  normalLow: { type: Number, default: null },
  normalHigh: { type: Number, default: null },
  criticalLow: { type: Number, default: null },
  criticalHigh: { type: Number, default: null },
  ageMin: { type: Number, default: null },
  ageMax: { type: Number, default: null },
  sexApplicable: { type: String, enum: ['Any', 'Male', 'Female'], default: 'Any' },
  // True for formula-derived entries (e.g. MCV, eGFR) — not directly billable alone.
  isDerived: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Test', TestSchema);
