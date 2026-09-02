const mongoose = require('mongoose');
const { OTP_EXPIRY_MINUTES } = require('../config/environment');

const otpSessionSchema = new mongoose.Schema({
  mobileNumber: {
    type: String,
    required: true,
    index: true,
  },
  otpHash: {
    type: String,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: OTP_EXPIRY_MINUTES * 60, // Document automatically removed after expiry
  }
});

module.exports = mongoose.model('OtpSession', otpSessionSchema);
