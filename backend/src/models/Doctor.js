const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  clinicHospital: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  referralPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  // Staff login linked to this referrer (for the separate doctor portal).
  linkedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Doctor', DoctorSchema);
