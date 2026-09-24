const XrayCase = require('../models/XrayCase');
const Patient = require('../models/Patient');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const { getBranchFilter, resolveBranchForCreate, assertBranchAccess } = require('../middleware/branchMiddleware');

const getXrayCases = async (req, res, next) => {
  try {
    const { search, date, status } = req.query;
    const query = { ...getBranchFilter(req) };

    if (status) query.status = status;

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    if (search) {
      const patients = await Patient.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id');
      query.patient = { $in: patients.map(p => p._id) };
    }

    const cases = await XrayCase.find(query)
      .populate('patient')
      .populate('referringDoctor')
      .sort({ date: -1 });

    return successResponse(res, 'X-Ray cases loaded successfully', cases);
  } catch (error) {
    next(error);
  }
};

const createXrayCase = async (req, res, next) => {
  try {
    const { patient, referringDoctor, findings, status } = req.body;
    
    if (!patient || !findings) {
      return errorResponse(res, 'Patient and findings text are required', 400);
    }

    let fileUrl = '';
    if (req.file) {
      fileUrl = `uploads/xray/${req.file.filename}`;
    }

    const newCase = await XrayCase.create({
      patient,
      branch: resolveBranchForCreate(req, req.body),
      referringDoctor: referringDoctor || null,
      findings,
      fileUrl,
      status: status || 'Completed'
    });

    const populatedCase = await XrayCase.findById(newCase._id)
      .populate('patient')
      .populate('referringDoctor');

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Create Xray Case',
      module: 'X-Ray',
      description: `Created Digital X-Ray case for patient ${populatedCase.patient.name}.`
    });

    return successResponse(res, 'X-Ray case created successfully', populatedCase, 201);
  } catch (error) {
    next(error);
  }
};

const updateXrayCase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { findings, referringDoctor, status } = req.body;

    const xrayCase = await XrayCase.findById(id);
    if (!xrayCase) return errorResponse(res, 'X-Ray Case not found', 404);
    try { assertBranchAccess(req, xrayCase.branch); } catch (e) { return errorResponse(res, 'Access denied for this branch', 403); }

    if (findings) xrayCase.findings = findings;
    if (referringDoctor) xrayCase.referringDoctor = referringDoctor;
    if (status) xrayCase.status = status;

    if (req.file) {
      // If we uploaded a new file, save it
      xrayCase.fileUrl = `uploads/xray/${req.file.filename}`;
    }

    await xrayCase.save();

    const populatedCase = await XrayCase.findById(xrayCase._id)
      .populate('patient')
      .populate('referringDoctor');

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Update Xray Case',
      module: 'X-Ray',
      description: `Updated X-Ray findings for patient ${populatedCase.patient.name}.`
    });

    return successResponse(res, 'X-Ray case updated successfully', populatedCase);
  } catch (error) {
    next(error);
  }
};

const getXrayCaseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const xrayCase = await XrayCase.findById(id)
      .populate('patient')
      .populate('referringDoctor');
    if (!xrayCase) return errorResponse(res, 'X-Ray Case not found', 404);
    try { assertBranchAccess(req, xrayCase.branch); } catch (e) { return errorResponse(res, 'Access denied for this branch', 403); }
    return successResponse(res, 'X-Ray case loaded successfully', xrayCase);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getXrayCases,
  getXrayCaseById,
  createXrayCase,
  updateXrayCase
};
