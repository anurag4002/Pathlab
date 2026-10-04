const mongoose = require('mongoose');

const ReferenceRangeSchema = new mongoose.Schema({
    _id: false,
    sex: { type: String, enum: ['Any', 'Male', 'Female'], default: 'Any' },
    ageMin: { type: Number, default: null }, ageMax: { type: Number, default: null },
    ageMinUnit: { type: String, enum: ['d', 'mo', 'y'], default: 'y' },
    ageMaxUnit: { type: String, enum: ['d', 'mo', 'y'], default: 'y' },
    referenceRange: { type: String, default: '' },
    normalLow: { type: Number, default: null }, normalHigh: { type: Number, default: null },
    lowInclusive: { type: Boolean, default: null }, highInclusive: { type: Boolean, default: null },
    criticalLow: { type: Number, default: null }, criticalHigh: { type: Number, default: null }
  }, { _id: false });

const TestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  sourceTestId: { type: String, index: true },
  sourceFieldId: { type: String },
  sourceFieldName: { type: String },
  sourceType: { type: String },
  sourceFee: { type: Number, default: null },
  shortName: { type: String, default: '' },
  displayOrder: { type: Number, default: null },
  sourceDefinition: { type: mongoose.Schema.Types.Mixed },
  sourceInterpretation: { type: mongoose.Schema.Types.Mixed },
  sourceRange: { type: mongoose.Schema.Types.Mixed },
  referenceAgeDaysPerYear: { type: Number, default: 365.25 },
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
  isDerived: { type: Boolean, default: false },
  // Turnaround time for this test in hours. Null = fall back to lab default
  // (Phase 16 TAT config). Consumed by the report worklist countdown.
  tatHours: { type: Number, default: null, min: 0 },
  formula: { type: String, trim: true, default: '' },
  resultOptions: [{ type: String, trim: true }],
  referenceRanges: [ReferenceRangeSchema],
  parameters: [{
    _id: false, code: { type: String, required: true }, name: { type: String, required: true },
    sourceFieldId: { type: String }, sourceFieldName: { type: String }, sourceRange: { type: mongoose.Schema.Types.Mixed },
    referenceAgeDaysPerYear: { type: Number, default: 365.25 },
    unit: { type: String, default: '' }, referenceRange: { type: String, default: '' },
    normalLow: { type: Number, default: null }, normalHigh: { type: Number, default: null },
    criticalLow: { type: Number, default: null }, criticalHigh: { type: Number, default: null },
    ageMin: { type: Number, default: null }, ageMax: { type: Number, default: null },
    sexApplicable: { type: String, enum: ['Any', 'Male', 'Female'], default: 'Any' },
    maleReferenceRange: { type: String, default: '' }, femaleReferenceRange: { type: String, default: '' },
    referenceRanges: [ReferenceRangeSchema],
    isDerived: { type: Boolean, default: false }, formula: { type: String, default: '' },
    resultOptions: [{ type: String, trim: true }]
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Test', TestSchema);
