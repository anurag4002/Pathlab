const mongoose = require('mongoose');

// Browser allow-list: only approved browser codes may log in (Labsmart FR-AUTH).
const WebBrowserSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, index: true },
  label: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['Active', 'Blocked'], default: 'Active', index: true },
  lastSeenAt: { type: Date, default: null },
  lastSeenIp: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('WebBrowser', WebBrowserSchema);
