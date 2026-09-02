const mongoose = require('mongoose');

const TestPackageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  gender: {
    type: String,
    enum: ['All', 'Male', 'Female'],
    default: 'All'
  },
  includedTests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test'
  }],
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

module.exports = mongoose.model('TestPackage', TestPackageSchema);
