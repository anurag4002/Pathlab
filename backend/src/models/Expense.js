const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
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
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Insurance'],
    default: 'Cash'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Expense', ExpenseSchema);
