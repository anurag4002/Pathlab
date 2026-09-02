const mongoose = require('mongoose');

const TestPanelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  tests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  }],
  price: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TestPanel', TestPanelSchema);
