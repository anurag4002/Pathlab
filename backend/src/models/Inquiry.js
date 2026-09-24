const mongoose = require('mongoose');

// Self-service booking inquiry from the patient portal.
// No bill, no payment: staff confirm at the counter and bill there.
// One phone number may raise many inquiries (family members share phones).
const InquiryItemSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['Test', 'Package', 'Other'],
    default: 'Other'
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const InquirySchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    default: null,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  items: {
    type: [InquiryItemSchema],
    default: []
  },
  preferredDate: {
    type: Date,
    default: null
  },
  note: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Confirmed', 'Cancelled'],
    default: 'New',
    index: true
  },
  source: {
    type: String,
    default: 'portal'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Inquiry', InquirySchema);
