const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  referringDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    default: null
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null
  },
  items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillItem'
  }],
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  dueAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Insurance'],
    default: 'Cash'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Partial', 'Paid'],
    default: 'Pending',
    index: true
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Modality / department for case-type split (LAB, USG, XRAY, CT, MRI, ...).
  department: {
    type: String,
    trim: true,
    default: 'LAB',
    index: true
  },
  // Case-wise report parity (§5): 13 Labsmart case types.
  caseType: {
    type: String,
    enum: ['LabCase', 'UsgCase', 'DigitalXrayCase', 'XrayCase', 'OutsourceLabCase', 'EcgCase', 'CtScanCase', 'MriCase', 'EpsCase', 'OpgCase', 'CardiologyCase', 'EegCase', 'MammographyCase'],
    default: 'LabCase',
    index: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null,
    index: true
  },
  collectionCentre: {
    type: String,
    trim: true,
    default: 'Main',
    index: true
  },
  // Exclude-cancelled filter parity. Prefer isVoided (fraud guard) but keep
  // a lightweight cancelled flag for Labsmart-style soft cancels.
  cancelled: {
    type: Boolean,
    default: false,
    index: true
  },
  cancelReason: {
    type: String,
    trim: true,
    default: ''
  },
  // Denormalised patient lookup helpers for case-wise grid (UHID + DCN).
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
  discountPercent: {
    type: Boolean,
    default: false
  },
  onlineReportRequested: {
    type: Boolean,
    default: false
  },
  // Public self-service token for bill QR (GET /r/bill/:token, no login).
  qrToken: {
    type: String,
    default: null,
    index: true
  },
  // Fraud guard: void instead of hard delete (P-9).
  isVoided: {
    type: Boolean,
    default: false,
    index: true
  },
  voidReason: {
    type: String,
    trim: true,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Bill', BillSchema);
