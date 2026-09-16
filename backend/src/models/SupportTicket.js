const mongoose = require('mongoose');

const SupportTicketSchema = new mongoose.Schema({
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  attachmentUrl: { type: String, default: '' },
  status: { type: String, enum: ['Open', 'InProgress', 'Resolved', 'Closed'], default: 'Open', index: true },
  meetLink: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', SupportTicketSchema);
