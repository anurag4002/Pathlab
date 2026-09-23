const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  // SPENT ON date label parity (defaults to voucher date when absent).
  spentOn: {
    type: Date,
    default: null,
    index: true
  },
  // NAME / title parity (short label; falls back to category).
  name: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  notes: { type: String, trim: true, default: '' },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Insurance'],
    default: 'Cash'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Expense', ExpenseSchema);
