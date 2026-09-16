const mongoose = require('mongoose');

// Google Review Builder: outbound review requests + conversion log.
const ReviewRequestSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null },
  phone: { type: String, trim: true, default: '' },
  channel: { type: String, enum: ['whatsapp', 'sms'], default: 'whatsapp' },
  status: { type: String, enum: ['Sent', 'Clicked', 'Reviewed'], default: 'Sent', index: true },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('ReviewRequest', ReviewRequestSchema);
