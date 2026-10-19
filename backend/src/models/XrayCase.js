const mongoose = require('mongoose');

const XrayCaseSchema = new mongoose.Schema({
  bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', index: true },
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
  findings: {
    type: String,
    default: ''
  },
  fileUrl: {
    type: String,
    trim: true
  },
  reportFile: {
    data: { type: Buffer, select: false },
    name: String,
    contentType: String,
    size: Number,
    uploadedAt: Date
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

XrayCaseSchema.index({ bill: 1 }, { name: 'unique_billed_xray_case', unique: true, partialFilterExpression: { bill: { $type: 'objectId' } } });
module.exports = mongoose.model('XrayCase', XrayCaseSchema);
