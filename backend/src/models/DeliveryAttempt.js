const mongoose = require('mongoose');

// DeliveryAttempt records every outbound patient-message attempt tied to a
// report/bill so the frontend delivery banner can be ungated later.
// Frontend shape: GET /api/reports/:id/delivery-status -> { report, deliveryHistory }
// where deliveryHistory is attempts sorted newest-first.
const DeliveryAttemptSchema = new mongoose.Schema({
  report: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    default: null,
    index: true
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    default: null,
    index: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    default: null,
    index: true
  },
  channel: {
    type: String,
    enum: ['sms', 'whatsapp', 'email'],
    required: true,
    index: true
  },
  to: {
    type: String,
    trim: true,
    default: ''
  },
  templateKey: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Sent', 'Failed', 'Pending'],
    default: 'Sent',
    index: true
  },
  error: {
    type: String,
    trim: true,
    default: ''
  },
  providerId: {
    type: String,
    trim: true,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DeliveryAttempt', DeliveryAttemptSchema);
