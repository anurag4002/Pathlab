const mongoose = require('mongoose');

const OtpSessionSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: false,
    default: '',
    index: true
  },
  email: {
    type: String,
    required: false,
    default: '',
    lowercase: true,
    trim: true,
    index: true
  },
  // sms | email
  channel: {
    type: String,
    enum: ['sms', 'email'],
    default: 'sms'
  },
  // patient-auth | staff-login | forgot-password
  purpose: {
    type: String,
    enum: ['patient-auth', 'staff-login', 'forgot-password'],
    default: 'patient-auth',
    index: true
  },
  otpHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0
  },
  attempts: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OtpSession', OtpSessionSchema);
