const mongoose = require('mongoose');

const USGCaseSchema = new mongoose.Schema({
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
  templateName: {
    type: String,
    trim: true
  },
  findings: {
    type: String,
    default: ''
  },
  bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', index: true },
  serviceType: { type: String, enum: ['with-report', 'without-report'] },
  price: { type: Number, min: 0 },
  reportFile: {
    data: { type: Buffer, select: false },
    name: String,
    contentType: String,
    size: Number,
    uploadedAt: Date
  },
  signatureUrl: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Completed'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('USGCase', USGCaseSchema);
