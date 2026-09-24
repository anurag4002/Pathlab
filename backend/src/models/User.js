const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['Admin', 'Employee', 'Doctor'],
    default: 'Employee'
  },
  password: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  // Granular permission matrix (Labsmart FR-MANAGE). Admin implies all.
  // Keys: billing, reports, rates, finance, settings, patients, delivery.
  permissions: {
    type: Map,
    of: Boolean,
    default: {}
  },
  designation: { type: String, trim: true, default: '' },
  qualification: { type: String, trim: true, default: '' },
  joiningDate: { type: Date, default: null },
  departments: { type: [String], default: [] },
  documents: { type: [String], default: [] },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
