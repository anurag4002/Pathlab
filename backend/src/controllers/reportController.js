const path = require('path');
const reportService = require('../services/reportService');
const storageService = require('../services/storageService');
const { reportPdf } = require('../services/pdfService');
const { qrDataURL, qrBuffer, reportVerifyUrl } = require('../services/qrService');
const Report = require('../models/Report');
const Test = require('../models/Test');
const LabProfile = require('../models/LabProfile');
const Signature = require('../models/Signature');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const getReports = async (req, res, next) => {
  try {
    const filters = {
      patientId: req.query.patientId,
      billId: req.query.billId,
      registrationNumber: req.query.registrationNumber,
      page: req.query.page,
      limit: req.query.limit
    };
    const data = await reportService.getReports(filters);
    return successResponse(res, 'Reports loaded successfully', data);
  } catch (error) {
    next(error);
  }
};

const uploadReport = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload a file', 400);
    }

    const { patient, bill, test } = req.body;
    if (!patient || !bill) {
      return errorResponse(res, 'Patient ID and Bill ID are required', 400);
    }

    const report = await reportService.createReport(
      { patient, bill, test },
      req.file,
      req.user
    );

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Upload Report',
      module: 'Lab',
      description: `Uploaded laboratory findings report for patient registration ${report.registrationNumber}.`
    });

    return successResponse(res, 'Report uploaded successfully', report, 201);
  } catch (error) {
    next(error);
  }
};

const downloadReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);
    if (!report || !report.fileUrl) {
      return errorResponse(res, 'Report file not found', 404);
    }

    const filepath = storageService.getFilePath(report.fileUrl);
    if (!filepath) {
      return errorResponse(res, 'Physical report file missing on server', 404);
    }

    const filename = `Report_${report.registrationNumber}_${id}${path.extname(report.fileUrl)}`;
    return res.download(filepath, filename);
  } catch (error) {
    next(error);
  }
};

const deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    await reportService.deleteReport(id);

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Delete Report',
      module: 'Lab',
      description: `Deleted laboratory report ID ${id}.`
    });

    return successResponse(res, 'Report deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReports,
  uploadReport,
  downloadReport,
  deleteReport,
  createResultReport,
  saveResults,
  signReport,
  updateTat,
  reportPdfDownload,
  reportQr
};

// ---- Result entry ----

async function createResultReport(req, res, next) {
  try {
    const { patient, bill } = req.body;
    if (!patient || !bill) return errorResponse(res, 'Patient ID and Bill ID are required', 400);
    const report = await reportService.createResultReport({ patient, bill }, req.user);
    await Activity.create({
      user: req.user._id, action: 'Create Result Report', module: 'Lab',
      description: `Registered result entry for ${report.registrationNumber}.`
    });
    return successResponse(res, 'Result report registered', report, 201);
  } catch (error) {
    next(error);
  }
}

async function saveResults(req, res, next) {
  try {
    const { results } = req.body;
    if (!Array.isArray(results) || results.length === 0) {
      return errorResponse(res, 'At least one result is required', 400);
    }
    const report = await reportService.saveResults(req.params.id, results, req.user);
    await Activity.create({
      user: req.user._id, action: 'Save Results', module: 'Lab',
      description: `Saved ${report.results.length} results for ${report.registrationNumber}.`
    });
    return successResponse(res, 'Results saved with auto-calculations', report);
  } catch (error) {
    next(error);
  }
}

async function signReport(req, res, next) {
  try {
    const report = await reportService.signReport(req.params.id, req.body.signatureId, req.user);
    await Activity.create({
      user: req.user._id, action: 'Sign Report', module: 'Lab',
      description: `Signed report ${report.registrationNumber}.`
    });
    return successResponse(res, 'Report signed', report);
  } catch (error) {
    next(error);
  }
}

async function updateTat(req, res, next) {
  try {
    const report = await reportService.updateTat(req.params.id, req.body || {});
    return successResponse(res, 'TAT updated', report);
  } catch (error) {
    next(error);
  }
}

// ---- Server-rendered PDF (letterhead toggle) + QR ----

async function loadReportPdfContext(id) {
  const report = await Report.findById(id).populate('patient').populate('bill');
  if (!report) {
    const err = new Error('Report not found');
    err.statusCode = 404;
    throw err;
  }
  const token = await reportService.ensureQrToken(report);
  const testIds = (report.results || []).map((r) => r.test).filter(Boolean);
  const tests = await Test.find({ _id: { $in: testIds } });
  const testMap = {};
  tests.forEach((t) => { testMap[String(t._id)] = t; });
  let profile = null;
  try { profile = await LabProfile.findOne(); } catch (e) { profile = null; }
  const sigIds = (report.signatures || []).map((s) => s.signature).filter(Boolean);
  const sigDocs = sigIds.length ? await Signature.find({ _id: { $in: sigIds } }) : [];
  const sigById = {};
  sigDocs.forEach((s) => { sigById[String(s._id)] = s; });
  const signaturePngs = (report.signatures || []).map((s) => {
    const d = sigById[String(s.signature)];
    if (!d || !d.imageUrl) return null;
    const abs = storageService.getFilePath(d.imageUrl);
    if (!abs) return null;
    try {
      return { png: require('fs').readFileSync(abs), name: d.name, title: d.title };
    } catch (e) { return null; }
  }).filter(Boolean);
  return { report, profile, testMap, token, signaturePngs };
}

async function reportPdfDownload(req, res, next) {
  try {
    const letterhead = req.query.letterhead !== '0';
    const ctx = await loadReportPdfContext(req.params.id);
    const qrPng = await qrBuffer(reportVerifyUrl(ctx.token));
    const pdf = await reportPdf(ctx, { letterhead, qrPng });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Report-PDF', 'v2-table-engine');
    res.setHeader('Content-Disposition', `attachment; filename="Report_${ctx.report.registrationNumber}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    next(error);
  }
}

async function reportQr(req, res, next) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return errorResponse(res, 'Report not found', 404);
    const token = await reportService.ensureQrToken(report);
    const dataUrl = await qrDataURL(reportVerifyUrl(token));
    return successResponse(res, 'Report QR generated', { qrToken: token, verifyUrl: reportVerifyUrl(token), qrDataUrl: dataUrl });
  } catch (error) {
    next(error);
  }
}
