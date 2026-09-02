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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Test', TestSchema);
