const Inquiry = require('../models/Inquiry');
const { successResponse, errorResponse } = require('../utils/response');

// GET /api/inquiries?status=&search=&page=&limit= — staff queue of
// self-service booking inquiries (Admin + Employee).
const { getBranchFilter, assertBranchAccess } = require('../middleware/branchMiddleware');

const listInquiries = async (req, res, next) => {
  try {
    const { status = '', search = '' } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const query = { ...getBranchFilter(req) };
    if (status) query.status = status;
    if (String(search).trim()) {
      const s = String(search).trim();
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } }
      ];
    }

    const [docs, total] = await Promise.all([
      Inquiry.find(query)
        .populate('patient', 'name registrationNumber age gender')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Inquiry.countDocuments(query)
    ]);
    return successResponse(res, 'Booking inquiries loaded', {
      inquiries: docs,
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) }
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/inquiries/:id — New -> Contacted -> Confirmed | Cancelled.
const setInquiryStatus = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['New', 'Contacted', 'Confirmed', 'Cancelled'].includes(status)) {
      return errorResponse(res, 'Invalid status', 400);
    }
    const existing = await Inquiry.findById(req.params.id).select('branch');
    if (!existing) return errorResponse(res, 'Inquiry not found', 404);
    try { assertBranchAccess(req, existing.branch); } catch (e) { return errorResponse(res, 'Access denied for this branch', 403); }
    const doc = await Inquiry.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!doc) return errorResponse(res, 'Inquiry not found', 404);
    return successResponse(res, 'Inquiry updated', doc);
  } catch (error) {
    next(error);
  }
};

module.exports = { listInquiries, setInquiryStatus };
