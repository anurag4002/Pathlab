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
      // Also match already-confirmed patients by registration number.
      const Patient = require('../models/Patient');
      const matched = await Patient.find({ registrationNumber: { $regex: s, $options: 'i' } }).select('_id').limit(20).lean().catch(() => []);
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        ...(matched.length ? [{ patient: { $in: matched.map((p) => p._id) } }] : []),
      ];
    }

    const [docs, total] = await Promise.all([
      Inquiry.find(query)
        .populate('patient', 'name registrationNumber age gender phone address email aadhaar uhid history')
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

// PUT /api/inquiries/:id — edit booking details before confirming.
// Allows staff to correct name/phone/items/preferredDate/note when a
// modification is requested. Status cannot be changed here (use PATCH).
const updateInquiry = async (req, res, next) => {
  try {
    const existing = await Inquiry.findById(req.params.id);
    if (!existing) return errorResponse(res, 'Inquiry not found', 404);
    try { assertBranchAccess(req, existing.branch); } catch (e) { return errorResponse(res, 'Access denied for this branch', 403); }
    if (existing.status === 'Cancelled') {
      return errorResponse(res, 'Cancelled inquiries cannot be edited', 400);
    }
    const { name, phone, items, preferredDate, note } = req.body || {};
    const updates = {};
    if (name !== undefined) {
      const n = String(name || '').trim();
      if (!n) return errorResponse(res, 'Patient name is required', 400);
      updates.name = n.slice(0, 120);
    }
    if (phone !== undefined) {
      const p = String(phone || '').trim();
      if (!p) return errorResponse(res, 'Phone is required', 400);
      updates.phone = p.slice(0, 20);
    }
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return errorResponse(res, 'At least one item is required', 400);
      }
      if (items.length > 20) {
        return errorResponse(res, 'Too many items in one booking (max 20)', 400);
      }
      updates.items = items.slice(0, 20).map((it) => ({
        kind: ['Test', 'Package'].includes(it.kind) ? it.kind : 'Other',
        refId: it.refId || null,
        name: String(it.name || 'Test').slice(0, 120),
        price: Math.max(0, Number(it.price) || 0)
      }));
      if (updates.items.some((it) => !it.name.trim())) {
        return errorResponse(res, 'Every item needs a name', 400);
      }
    }
    if (preferredDate !== undefined) {
      if (!preferredDate) {
        updates.preferredDate = null;
      } else {
        const d = new Date(preferredDate);
        if (Number.isNaN(d.getTime())) return errorResponse(res, 'Invalid preferred date', 400);
        updates.preferredDate = d;
      }
    }
    if (note !== undefined) {
      updates.note = String(note || '').slice(0, 500);
    }
    if (Object.keys(updates).length === 0) {
      return errorResponse(res, 'No editable fields provided', 400);
    }
    const doc = await Inquiry.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('patient', 'name registrationNumber age gender phone address email aadhaar uhid history');
    return successResponse(res, 'Booking updated', doc);
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

module.exports = { listInquiries, setInquiryStatus, updateInquiry };
