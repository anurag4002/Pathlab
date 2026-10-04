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
  // Mixed bills: separate shells for catalog value-entry vs outsource file upload.
  // Legacy reports omit this (treated as 'all' / bill-level modality).
  entryMode: {
    type: String,
    enum: ['inhouse', 'outsource', 'all'],
    default: 'all',
    index: true
  },
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    default: null
  },
  // Labsmart §16 parity: UHID / Daily case no. / Collection centre.
  // Optional with defaults so old upload-only reports stay valid.
  uhid: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  dailyCaseNo: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null,
    index: true
  },
  cc: {
    type: String,
    trim: true,
    default: 'Main',
    index: true
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
    derived: { type: Boolean, default: false },
    parameterCode: { type: String, default: '' },
    referenceRange: { type: String, default: '' }
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
    enum: ['Pending', 'Registered', 'Collected', 'Received', 'Reported', 'Signed', 'Completed', 'Draft', 'Verified', 'Rejected'],
    default: 'Completed',
    index: true
  },
  // Verification workflow (backward-compat: all optional with defaults).
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectReason: {
    type: String,
    trim: true,
    default: ''
  },
  resendCount: {
    type: Number,
    default: 0
  },
  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    body: { type: String, trim: true, default: '' },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Speeds pending-cases distincts and status filters
ReportSchema.index({ status: 1, bill: 1 });
ReportSchema.index({ branch: 1, status: 1 });
ReportSchema.index({ bill: 1, entryMode: 1 });

module.exports = mongoose.model('Report', ReportSchema);
