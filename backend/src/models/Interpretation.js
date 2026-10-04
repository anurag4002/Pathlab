const mongoose = require('mongoose');

const InterpretationSchema = new mongoose.Schema({
  sourceTestId: { type: String, index: true },
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true,
    index: true
  },
  resultCondition: {
    type: String,
    required: true,
    trim: true
  },
  interpretationText: {
    type: String,
    required: true,
    trim: true
  },
  normalAbnormalGuidance: {
    type: String,
    enum: ['Normal', 'Abnormal', 'General'],
    default: 'Normal'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Interpretation', InterpretationSchema);
