const mongoose = require('mongoose');

// Background job queue (notify resends, server exports, ...).
// Failed notify sends are persisted here so Admin can inspect + retry.
const JobSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['notify', 'export'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Running', 'Failed', 'Done'],
    default: 'Pending',
    index: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  error: {
    type: String,
    trim: true,
    default: ''
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0
  },
  maxAttempts: {
    type: Number,
    default: 3,
    min: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Job', JobSchema);
