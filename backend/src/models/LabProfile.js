const mongoose = require('mongoose');

// Singleton-ish lab/centre profile: letterhead, contact, delivery toggles.
const LabProfileSchema = new mongoose.Schema({
  labName: { type: String, trim: true, default: 'PURE PATH LAB' },
  tagline: { type: String, trim: true, default: 'Pathology & Diagnostic Center' },
  phone: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  logoUrl: { type: String, default: '' },
  letterheadUrl: { type: String, default: '' },
  letterheadTopMargin: { type: Number, default: 90 },
  // Bill/report print defaults
  showLetterheadByDefault: { type: Boolean, default: true },
  // Delivery opt-ins + sender ids
  smsEnabled: { type: Boolean, default: false },
  whatsappEnabled: { type: Boolean, default: false },
  emailEnabled: { type: Boolean, default: false },
  smsSenderId: { type: String, trim: true, default: 'PUREPATH' },
  googleReviewLink: { type: String, trim: true, default: '' },
  caseStartNumber: { type: Number, default: 1 },
  // Phase 24+ branding / registration extras (server allow-list).
  website: { type: String, trim: true, default: '' },
  disclaimer: { type: String, trim: true, default: '' },
  invoiceFooter: { type: String, trim: true, default: '' },
  registrationPrefix: { type: String, trim: true, uppercase: true, default: '' },
  registrationNumber: { type: String, trim: true, default: '' },
  dateFormat: { type: String, trim: true, default: 'YYYYMMDD' },
  barcodeFormat: { type: String, trim: true, default: 'CODE39' }
}, { timestamps: true });

module.exports = mongoose.model('LabProfile', LabProfileSchema);
