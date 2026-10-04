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
  ageUnit: { type: String, enum: ['years', 'months', 'days'], default: 'years' },
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
    trim: true,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  aadhaar: {
    type: String,
    trim: true,
    default: ''
  },
  history: {
    type: String,
    trim: true,
    default: ''
  },
  title: {
    type: String,
    trim: true,
    default: ''
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null,
    index: true
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
