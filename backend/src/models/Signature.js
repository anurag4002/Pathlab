const mongoose = require('mongoose');

// E-signature masters (doctor/authority sign images), auto-placed on PDFs.
const SignatureSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  title: { type: String, trim: true, default: '' },
  imageUrl: { type: String, required: true },
  modalities: [{ type: String, trim: true }],
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Signature', SignatureSchema);
