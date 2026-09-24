const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  age: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  phone: {
    type: String,
    required: true,
    index: true
  },
  // Universal Health ID (Labsmart §11). Optional + sparse so existing
  // records stay valid; new registrations can enforce uniqueness.
  uhid: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  address: {
    type: String,
    trim: true
  },
  referringDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    default: null
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Patient', PatientSchema);
