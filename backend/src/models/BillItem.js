const mongoose = require('mongoose');

const BillItemSchema = new mongoose.Schema({
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: true,
    index: true
  },
  itemType: {
    type: String,
    enum: ['Test', 'TestPackage', 'TestPanel', 'Custom'],
    required: true
  },
  // Optional for Custom (outsource) lines typed at the counter
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function requiredItemId() {
      return this.itemType !== 'Custom';
    },
    default: null,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BillItem', BillItemSchema);
