const mongoose = require('mongoose');

// Message templates for SMS/WhatsApp/Email delivery (Welcome/Bill/Ready/OTP...).
const NotificationTemplateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true, index: true },
  channel: { type: String, enum: ['sms', 'whatsapp', 'email'], required: true, index: true },
  subject: { type: String, trim: true, default: '' },
  body: { type: String, required: true },
  variables: [{ type: String, trim: true }],
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('NotificationTemplate', NotificationTemplateSchema);
