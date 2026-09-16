const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  yearlyCaseCap: { type: Number, default: 12000 },
  dailyCourtesyCap: { type: Number, default: 200 },
  price: { type: Number, default: 0, min: 0 },
  features: [{ type: String, trim: true }],
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

const SubscriptionSchema = new mongoose.Schema({
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  status: { type: String, enum: ['Trial', 'Active', 'Expired', 'Cancelled'], default: 'Trial', index: true },
  trialEndsAt: { type: Date, default: null },
  currentYearCount: { type: Number, default: 0 },
  yearWindowStart: { type: Date, default: Date.now },
  gstName: { type: String, trim: true, default: '' },
  gstNumber: { type: String, trim: true, default: '' },
  refundRequested: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = {
  Plan: mongoose.model('Plan', PlanSchema),
  Subscription: mongoose.model('Subscription', SubscriptionSchema)
};
