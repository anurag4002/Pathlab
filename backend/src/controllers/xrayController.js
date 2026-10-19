const XrayCase = require('../models/XrayCase');
const Patient = require('../models/Patient');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const { getBranchFilter, resolveBranchForCreate, assertBranchAccess } = require('../middleware/branchMiddleware');
const { persistRequestFiles } = require('../middleware/uploadMiddleware');
const { isPdfUpload, assignReportPdf } = require('../services/xrayReportService');

const getXrayCases = async (req, res, next) => {
  try {
    const { search, date, status } = req.query;
    const branchScope = getBranchFilter(req);
    await require('../services/imagingBillService').recoverMissingImagingCases(branchScope, 'XRAY');
    const query = { ...branchScope };

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
      }).select('_id').limit(100).lean();
      query.patient = { $in: patients.map(p => p._id) };
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const cases = await XrayCase.find(query)
      .populate('patient', 'name registrationNumber phone age gender')
      .populate('referringDoctor', 'name clinicHospital')
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return successResponse(res, 'X-Ray cases loaded successfully', cases);
  } catch (error) {
    next(error);
  }
};

const createXrayCase = async (req, res, next) => {
  try {
    const { patient, referringDoctor, findings, status } = req.body;
    
    if (!patient || (!findings?.trim() && !isPdfUpload(req.file))) {
      return errorResponse(res, 'Patient and either findings or a PDF report are required', 400);
    }

    let fileUrl = '';
    if (req.file && !isPdfUpload(req.file)) {
      persistRequestFiles(req, 'xray');
      fileUrl = `uploads/xray/${req.file.filename}`;
    }

    const newCase = new XrayCase({
      patient,
      branch: resolveBranchForCreate(req, req.body),
      referringDoctor: referringDoctor || null,
      findings: findings || '',
      fileUrl,
      status: status || 'Completed'
    });
    if (isPdfUpload(req.file)) assignReportPdf(newCase, req.file);
    await newCase.save();

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

    if (findings !== undefined) xrayCase.findings = findings;
    if (referringDoctor) xrayCase.referringDoctor = referringDoctor;
    if (status) xrayCase.status = status;

    if (isPdfUpload(req.file)) {
      assignReportPdf(xrayCase, req.file);
    } else if (req.file) {
      const storageService = require('../services/storageService');
      // Persist the new buffer first, then remove the replaced file so a
      // failed write never orphans the old record without a file.
      persistRequestFiles(req, 'xray');
      const oldUrl = xrayCase.fileUrl;
      xrayCase.fileUrl = `uploads/xray/${req.file.filename}`;
      if (oldUrl && oldUrl !== xrayCase.fileUrl) {
        await storageService.deleteFile(oldUrl);
      }
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

const uploadXrayReport = async (req, res, next) => {
  try {
    const record = await XrayCase.findById(req.params.id);
    if (!record) return errorResponse(res, 'X-Ray case not found', 404);
    assertBranchAccess(req, record.branch);
    assignReportPdf(record, req.file);
    await record.save();
    await Activity.create({ user: req.user._id, action: 'Upload X-Ray Report', module: 'X-Ray', description: `Uploaded PDF report for X-Ray case ${record._id}.` });
    const result = record.toObject(); delete result.reportFile.data;
    return successResponse(res, 'X-Ray PDF report uploaded', result);
  } catch (error) { next(error); }
};

const downloadXrayReport = async (req, res, next) => {
  try {
    const record = await XrayCase.findById(req.params.id).select('+reportFile.data');
    if (!record) return errorResponse(res, 'X-Ray case not found', 404);
    assertBranchAccess(req, record.branch);
    if (!record.reportFile?.data?.length) return errorResponse(res, 'No PDF report has been uploaded.', 404);
    res.type('application/pdf'); res.attachment(record.reportFile.name || 'X-Ray-report.pdf');
    return res.send(record.reportFile.data);
  } catch (error) { next(error); }
};

module.exports = {
  getXrayCases,
  getXrayCaseById,
  createXrayCase,
  updateXrayCase,
  uploadXrayReport,
  downloadXrayReport
};
