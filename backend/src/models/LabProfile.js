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
  // Footer strip image (bottom marketing/sign-off band on PDFs).
  footerUrl: { type: String, default: '' },
  documentFormats: { type: [mongoose.Schema.Types.Mixed], default: () => [{ ...require('../services/documentTemplateService').REFERENCE_FORMAT }] },
  reportFormatId: { type: String, default: 'reference' },
  billFormatId: { type: String, default: 'reference' },
  // Bill/report print defaults — each maps to one block of the lab's
  // reference report format (patient band, barcode/QR, TAT dates,
  // department headings, flag column, interpretation box, end-of-report
  // line, signatures, watermark, footer strip, page number).
  showLetterheadByDefault: { type: Boolean, default: true },
  showFooterByDefault: { type: Boolean, default: true },
  showBarcode: { type: Boolean, default: true },
  showQR: { type: Boolean, default: true },
  showTatDates: { type: Boolean, default: true },
  showReferredBy: { type: Boolean, default: true },
  showDepartmentHeading: { type: Boolean, default: true },
  showFlagColumn: { type: Boolean, default: true },
  showInterpretation: { type: Boolean, default: true },
  showEndOfReport: { type: Boolean, default: true },
  showSignatures: { type: Boolean, default: true },
  showWatermark: { type: Boolean, default: true },
  showPageNumber: { type: Boolean, default: true },
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
