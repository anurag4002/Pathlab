const mongoose = require('mongoose');

// Generic modality case for CT/MRI/ECG/OPG/EEG/Mammo/Cardio/EPS/Outsource...
// (LAB/USG/XRAY keep their dedicated flows; this covers the other 10 depts.)
const ModalityCaseSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null, index: true },
  modality: { type: String, required: true, trim: true, uppercase: true, index: true },
  procedure: { type: String, trim: true, default: '' },
  findings: { type: String, trim: true, default: '' },
  impression: { type: String, trim: true, default: '' },
  templateId: { type: String, trim: true, default: '' },
  outsourcedTo: { type: String, trim: true, default: '' },
  status: {
    type: String,
    enum: ['Registered', 'InProgress', 'Reported', 'Signed'],
    default: 'Registered',
    index: true
  },
  reportFileUrl: { type: String, default: '' },
  qrToken: { type: String, default: null, index: true },
  signatures: [{
    signature: { type: mongoose.Schema.Types.ObjectId, ref: 'Signature', default: null },
    signedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    signedAt: { type: Date, default: null }
  }],
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  caseDate: { type: Date, default: Date.now, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('ModalityCase', ModalityCaseSchema);
