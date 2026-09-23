const NotificationTemplate = require('../models/NotificationTemplate');
const ReviewRequest = require('../models/ReviewRequest');
const LabProfile = require('../models/LabProfile');
const { getBalance, topup, getHistory } = require('../services/creditsService');
const { sendTemplated } = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');
const Job = require('../models/Job');

const DEFAULT_TEMPLATES = [
  { key: 'otp', channel: 'sms', body: 'Your Pure Path Lab OTP is {{otp}}. Valid for 5 minutes.', variables: ['otp'] },
  { key: 'bill-ready', channel: 'sms', body: 'Dear {{name}}, your bill {{billNumber}} of Rs.{{total}} is ready. Due: Rs.{{due}}. - {{lab}}', variables: ['name', 'billNumber', 'total', 'due', 'lab'] },
  { key: 'report-ready', channel: 'sms', body: 'Dear {{name}}, your report ({{regNo}}) is ready. Download: {{url}} - {{lab}}', variables: ['name', 'regNo', 'url', 'lab'] },
  { key: 'report-ready-wa', channel: 'whatsapp', body: 'Hello {{name}}, your report ({{regNo}}) is ready. Download here: {{url}}', variables: ['name', 'regNo', 'url'] },
  { key: 'welcome', channel: 'email', subject: 'Welcome to {{lab}}', body: 'Dear {{name}}, your registration number is {{regNo}}. View reports online with your mobile OTP.', variables: ['name', 'regNo', 'lab'] }
];

const listTemplates = async (req, res, next) => {
  try {
    let docs = await NotificationTemplate.find().sort({ channel: 1, key: 1 });
    if (docs.length === 0) {
      docs = await NotificationTemplate.insertMany(DEFAULT_TEMPLATES);
    }
    return successResponse(res, 'Templates loaded', docs);
  } catch (error) {
    next(error);
  }
};

const upsertTemplate = async (req, res, next) => {
  try {
    const { key, channel, subject, body } = req.body;
    if (!key || !channel || !body) return errorResponse(res, 'key, channel and body are required', 400);
    const doc = await NotificationTemplate.findOneAndUpdate(
      { key },
      { key, channel, subject: subject || '', body },
      { new: true, upsert: true }
    );
    return successResponse(res, 'Template saved', doc);
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { channel, templateKey, to, vars, reportId, billId } = req.body;
    if (!['sms', 'whatsapp', 'email'].includes(channel)) return errorResponse(res, 'Invalid channel', 400);
    if (!to) return errorResponse(res, 'Recipient is required', 400);
    const result = await sendTemplated(channel, templateKey, to, vars || {});
    // Record a DeliveryAttempt whenever a report/bill context is present
    // (backward-compat: silently skip if model or ids unavailable).
    // Also record channel-only sends with report/bill null would add noise,
    // so only record when reportId or billId is supplied.
    if (reportId || billId) {
      try {
        const DeliveryAttempt = require('../models/DeliveryAttempt');
        let patientRef = null;
        if (reportId) {
          try {
            const Report = require('../models/Report');
            const rep = await Report.findById(reportId).select('patient bill');
            if (rep) {
              patientRef = rep.patient || null;
              // Fall back to the report's own bill when billId not supplied.
              req.body._resolvedBillId = billId || (rep.bill ? String(rep.bill) : null);
            }
          } catch (e) { /* best-effort lookup */ }
        }
        await DeliveryAttempt.create({
          report: reportId || null,
          bill: billId || req.body._resolvedBillId || null,
          patient: patientRef,
          channel,
          to: String(to),
          templateKey: templateKey || '',
          status: result.ok ? 'Sent' : 'Failed',
          error: result.ok ? '' : (result.error || 'Send failed'),
          providerId: result.messageId || result.provider || '',
          createdBy: req.user ? req.user._id : null
        });
      } catch (e) { /* delivery log best-effort; never blocks send */ }
    }
    if (!result.ok) return errorResponse(res, result.error || 'Send failed', 402);
    await Activity.create({
      user: req.user._id, action: 'Send Message', module: 'Delivery',
      description: `Sent ${channel} (${templateKey}) to ${to}.`, ip: req.ip, userAgent: req.headers['user-agent'] || ''
    });
    return successResponse(res, 'Message sent', result);
  } catch (error) {
    // Persist failed sends so Admin can inspect + retry via GET /api/jobs.
    try {
      await Job.create({
        type: 'notify',
        status: 'Failed',
        payload: req.body || {},
        error: error.message || 'Notify send threw',
        attempts: 1,
        createdBy: req.user ? req.user._id : null
      });
    } catch (e) { /* job ledger best-effort */ }
    next(error);
  }
};

const getCredits = async (req, res, next) => {
  try {
    const data = await getHistory(50);
    return successResponse(res, 'Credits loaded', data);
  } catch (error) {
    next(error);
  }
};

const topupCredits = async (req, res, next) => {
  try {
    const balance = await topup(Number(req.body.credits), req.body.note || 'Manual top-up');
    return successResponse(res, 'Credits added', { balance });
  } catch (error) {
    next(error);
  }
};

// ---- Google Review Builder ----

const listReviews = async (req, res, next) => {
  try {
    const docs = await ReviewRequest.find().populate('patient', 'name phone').sort({ createdAt: -1 }).limit(100);
    let profile = null;
    try { profile = await LabProfile.findOne(); } catch (e) { profile = null; }
    return successResponse(res, 'Review requests loaded', { requests: docs, googleReviewLink: profile ? profile.googleReviewLink : '' });
  } catch (error) {
    next(error);
  }
};

const sendReviewRequest = async (req, res, next) => {
  try {
    let profile = null;
    try { profile = await LabProfile.findOne(); } catch (e) { profile = null; }
    if (!profile || !profile.googleReviewLink) return errorResponse(res, 'Set the Google review link in Lab Profile first', 400);
    const { patient, phone } = req.body;
    const text = `Thank you for visiting ${profile.labName || 'us'}! Please rate us: ${profile.googleReviewLink}`;
    const result = await sendTemplated('whatsapp', 'review', phone, { fallbackText: text });
    if (!result.ok) return errorResponse(res, result.error || 'Send failed', 402);
    const doc = await ReviewRequest.create({ patient: patient || null, phone, channel: 'whatsapp', status: 'Sent', sentBy: req.user._id });
    return successResponse(res, 'Review request sent', doc, 201);
  } catch (error) {
    next(error);
  }
};

const markReview = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Clicked', 'Reviewed'].includes(status)) return errorResponse(res, 'Invalid status', 400);
    const doc = await ReviewRequest.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!doc) return errorResponse(res, 'Request not found', 404);
    return successResponse(res, 'Review status updated', doc);
  } catch (error) {
    next(error);
  }
};

module.exports = { listTemplates, upsertTemplate, sendMessage, getCredits, topupCredits, listReviews, sendReviewRequest, markReview };
