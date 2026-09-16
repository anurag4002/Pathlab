const SupportTicket = require('../models/SupportTicket');
const { Plan, Subscription } = require('../models/Subscription');
const { successResponse, errorResponse } = require('../utils/response');

// ---- Support tickets ----

const listTickets = async (req, res, next) => {
  try {
    const docs = await SupportTicket.find().populate('createdBy', 'name').sort({ createdAt: -1 }).limit(100);
    return successResponse(res, 'Tickets loaded', docs);
  } catch (error) {
    next(error);
  }
};

const createTicket = async (req, res, next) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) return errorResponse(res, 'Subject and message are required', 400);
    const doc = await SupportTicket.create({ subject, message, createdBy: req.user._id });
    return successResponse(res, 'Ticket raised. Support responds within business hours.', doc, 201);
  } catch (error) {
    next(error);
  }
};

const setTicketStatus = async (req, res, next) => {
  try {
    const { status, meetLink } = req.body;
    if (status && !['Open', 'InProgress', 'Resolved', 'Closed'].includes(status)) {
      return errorResponse(res, 'Invalid status', 400);
    }
    const patch = {};
    if (status) patch.status = status;
    if (meetLink !== undefined) patch.meetLink = meetLink;
    const doc = await SupportTicket.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!doc) return errorResponse(res, 'Ticket not found', 404);
    return successResponse(res, 'Ticket updated', doc);
  } catch (error) {
    next(error);
  }
};

// ---- Plans & subscription ----

const DEFAULT_PLANS = [
  { name: 'Basic', yearlyCaseCap: 12000, dailyCourtesyCap: 200, price: 0, features: ['Billing', 'Reports', 'Patient portal'] },
  { name: 'Advanced', yearlyCaseCap: 20000, dailyCourtesyCap: 200, price: 0, features: ['Everything in Basic', 'USG/X-Ray', 'WhatsApp delivery'] },
  { name: 'Premium', yearlyCaseCap: 50000, dailyCourtesyCap: 500, price: 0, features: ['Everything in Advanced', 'Formula engine', 'Review builder'] }
];

const getSubscription = async (req, res, next) => {
  try {
    let plans = await Plan.find({ status: 'Active' });
    if (plans.length === 0) plans = await Plan.insertMany(DEFAULT_PLANS);
    let sub = await Subscription.findOne().populate('plan');
    if (!sub) {
      const trialPlan = plans[0];
      sub = await Subscription.create({
        plan: trialPlan._id, status: 'Trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        currentYearCount: 0, yearWindowStart: new Date()
      });
      sub = await Subscription.findById(sub._id).populate('plan');
    }
    return successResponse(res, 'Subscription loaded', { subscription: sub, plans });
  } catch (error) {
    next(error);
  }
};

const changePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.body.planId);
    if (!plan) return errorResponse(res, 'Plan not found', 404);
    let sub = await Subscription.findOne();
    if (!sub) sub = new Subscription({ yearWindowStart: new Date() });
    sub.plan = plan._id;
    sub.status = 'Active';
    if (req.body.gstName !== undefined) sub.gstName = req.body.gstName;
    if (req.body.gstNumber !== undefined) sub.gstNumber = req.body.gstNumber;
    await sub.save();
    sub = await Subscription.findById(sub._id).populate('plan');
    return successResponse(res, 'Plan changed', sub);
  } catch (error) {
    next(error);
  }
};

const requestRefund = async (req, res, next) => {
  try {
    const sub = await Subscription.findOne();
    if (!sub) return errorResponse(res, 'No subscription found', 404);
    sub.refundRequested = true;
    await sub.save();
    return successResponse(res, 'Refund requested. Valid within 7 days of purchase.', sub);
  } catch (error) {
    next(error);
  }
};

module.exports = { listTickets, createTicket, setTicketStatus, getSubscription, changePlan, requestRefund };
