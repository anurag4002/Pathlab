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
