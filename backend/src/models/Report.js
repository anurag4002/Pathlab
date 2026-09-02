const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  registrationNumber: {
    type: String,
    required: true,
    index: true
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: true,
    index: true
  },
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    default: null
  },
  fileUrl: {
    type: String,
    required: true
  },
  reportDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Completed'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', ReportSchema);
