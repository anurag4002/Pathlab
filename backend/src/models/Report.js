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
    required: false,
    default: ''
  },
  // Result-entry (Labsmart parity): structured values instead of upload-only.
  results: [{
    test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', default: null },
    testName: { type: String, trim: true },
    value: { type: String, trim: true },
    unit: { type: String, trim: true },
    // L = low, H = high, C = critical, N = normal
    flag: { type: String, enum: ['N', 'L', 'H', 'C', ''], default: '' },
    derived: { type: Boolean, default: false }
  }],
  // Turnaround-time tracking (4 dates).
  tat: {
    registered: { type: Date, default: Date.now },
    collected: { type: Date, default: null },
    received: { type: Date, default: null },
    reported: { type: Date, default: null }
  },
  // E-signatures placed on the PDF ( Signature refs + placement ).
  signatures: [{
    signature: { type: mongoose.Schema.Types.ObjectId, ref: 'Signature', default: null },
    signedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    signedAt: { type: Date, default: null }
  }],
  // Public self-service token for QR download (GET /r/:token, no login).
  qrToken: {
    type: String,
    default: null,
    index: true
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
    enum: ['Pending', 'Registered', 'Collected', 'Received', 'Reported', 'Signed', 'Completed'],
    default: 'Completed'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', ReportSchema);
