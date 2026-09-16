const mongoose = require('mongoose');

// SMS/WhatsApp credits ledger: singleton balance + top-up/spend history.
const SmsCreditSchema = new mongoose.Schema({
  // Always 'default' — one ledger per lab.
  key: { type: String, unique: true, default: 'default' },
  balance: { type: Number, default: 100, min: 0 },
  history: [{
    kind: { type: String, enum: ['topup', 'spend', 'adjust'], required: true },
    credits: { type: Number, required: true },
    note: { type: String, trim: true, default: '' },
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('SmsCredit', SmsCreditSchema);
