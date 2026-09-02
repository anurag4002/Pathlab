const mongoose = require('mongoose');

const InterpretationSchema = new mongoose.Schema({
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
    enum: ['Normal', 'Abnormal'],
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
