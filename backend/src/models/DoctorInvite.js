const mongoose = require('mongoose');

// Doctor portal invites: emailed/logged token the doctor uses to activate access.
const DoctorInviteSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  token: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['Pending', 'Accepted', 'Expired'], default: 'Pending', index: true },
  expiresAt: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('DoctorInvite', DoctorInviteSchema);
