const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  action: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Activity', ActivitySchema);
