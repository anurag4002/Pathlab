const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    default: null,
    index: true
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    default: null,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Insurance'],
    required: true
  },
  type: {
    type: String,
    enum: ['Income', 'Refund', 'Expense'],
    required: true,
    index: true
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', TransactionSchema);
