const path = require('path');
const reportService = require('../services/reportService');
const storageService = require('../services/storageService');
const { reportPdf } = require('../services/pdfService');
const { qrDataURL, qrBuffer, reportVerifyUrl } = require('../services/qrService');
const Report = require('../models/Report');
const Test = require('../models/Test');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const LabProfile = require('../models/LabProfile');
const Signature = require('../models/Signature');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const getReports = async (req, res, next) => {
  try {
    const filters = {
      patientId: req.query.patientId,
      billId: req.query.billId,
      registrationNumber: req.query.registrationNumber || req.query.regNo,
      regNo: req.query.regNo,
      status: req.query.status,
      uhid: req.query.uhid,
      dailyCaseNo: req.query.dailyCaseNo,
      cc: req.query.cc,
      test: req.query.test,
      firstName: req.query.firstName || req.query.patientName,
      referredBy: req.query.referredBy,
      duration: req.query.duration,
      from: req.query.from || req.query.startDate,
      to: req.query.to || req.query.endDate,
      search: req.query.search,
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
  reportQr,
  getPendingLabCases,
  getReportForEntry,
  saveResultsDraft,
  submitResults,
  verifyReport,
  rejectReport,
  resendReport,
  addReportComment,
  getDeliveryStatus
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
  return { report, patient: report.patient || null, bill: report.bill || null, profile, testMap, token, signaturePngs };
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

// ---- Result entry workflow ----

// GET /reports/pending-cases - Get lab bills pending result entry
async function getPendingLabCases(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find LAB department bills that don't have a report, or have a report in Registered/Draft status
    const billsWithReports = await Report.find({ status: { $in: ['Registered', 'Draft', 'Reported', 'Signed', 'Completed'] } }).distinct('bill');

    const query = {
      department: 'LAB',
      isVoided: { $ne: true },
      _id: { $nin: billsWithReports }
    };

    // Also include bills that have a report in Registered status (draft)
    const draftReportBills = await Report.find({ status: 'Registered' }).distinct('bill');
    
    // Combine: bills without reports OR bills with draft reports
    const finalQuery = {
      $or: [
        { _id: { $nin: billsWithReports }, department: 'LAB', isVoided: { $ne: true } },
        { _id: { $in: draftReportBills }, department: 'LAB', isVoided: { $ne: true } }
      ]
    };

    const bills = await Bill.find(finalQuery)
      .populate('patient', 'name registrationNumber age gender phone')
      .populate('items')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get report status for each bill
    const billIds = bills.map(b => b._id);
    const reports = await Report.find({ bill: { $in: billIds } }).select('bill status registrationNumber');
    const reportMap = {};
    reports.forEach(r => { reportMap[String(r.bill)] = { status: r.status, registrationNumber: r.registrationNumber, _id: r._id }; });

    const data = bills.map(bill => {
      const reportInfo = reportMap[String(bill._id)];
      return {
        bill: {
          _id: bill._id,
          billNumber: bill.billNumber,
          date: bill.date,
          patient: bill.patient,
          items: bill.items
        },
        report: reportInfo || { status: 'Pending' }
      };
    });

    const total = await Bill.countDocuments(finalQuery);

    return successResponse(res, 'Pending lab cases loaded', {
      cases: data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
}

// GET /reports/:id/entry - Get report with full test details for result entry
async function getReportForEntry(req, res, next) {
  try {
    const report = await Report.findById(req.params.id)
      .populate('patient', 'name registrationNumber age gender phone address referringDoctor')
      .populate({
        path: 'bill',
        populate: {
          path: 'items',
          model: 'BillItem'
        }
      });

    if (!report) {
      return errorResponse(res, 'Report not found', 404);
    }

    // Resolve tests from bill items (Test, TestPackage, TestPanel)
    const TestPackage = require('../models/TestPackage');
    const TestPanel = require('../models/TestPanel');

    let allTests = [];
    if (report.bill && report.bill.items) {
      for (const item of report.bill.items) {
        if (item.itemType === 'Test' && item.itemId) {
          allTests.push({ type: 'Test', itemId: item.itemId, name: item.name });
        } else if (item.itemType === 'TestPackage' && item.itemId) {
          const pkg = await TestPackage.findById(item.itemId).populate('includedTests');
          if (pkg && pkg.includedTests) {
            pkg.includedTests.forEach(t => allTests.push({ type: 'Test', itemId: t._id, name: t.name, packageName: pkg.name }));
          }
        } else if (item.itemType === 'TestPanel' && item.itemId) {
          const panel = await TestPanel.findById(item.itemId).populate('tests');
          if (panel && panel.tests) {
            panel.tests.forEach(t => allTests.push({ type: 'Test', itemId: t._id, name: t.name, panelName: panel.name }));
          }
        }
      }
    }

    // Get full test details
    const testIds = [...new Set(allTests.map(t => t.itemId).filter(Boolean))];
    const tests = await Test.find({ _id: { $in: testIds } });
    const testMap = {};
    tests.forEach(t => { testMap[String(t._id)] = t; });

    // Merge with existing results
    const existingResults = report.results || [];
    const existingResultMap = {};
    existingResults.forEach(r => {
      if (r.test) existingResultMap[String(r.test)] = r;
    });

    const testEntries = allTests.map(t => {
      const test = testMap[String(t.itemId)];
      const existing = test ? existingResultMap[String(t.itemId)] : null;
      return {
        testId: t.itemId,
        testName: test?.name || t.name,
        testCode: test?.code || '',
        category: test?.category,
        unit: test?.unit || '',
        referenceRange: test?.referenceRange || '',
        maleReferenceRange: test?.maleReferenceRange || '',
        femaleReferenceRange: test?.femaleReferenceRange || '',
        normalLow: test?.normalLow,
        normalHigh: test?.normalHigh,
        criticalLow: test?.criticalLow,
        criticalHigh: test?.criticalHigh,
        ageMin: test?.ageMin,
        ageMax: test?.ageMax,
        sexApplicable: test?.sexApplicable,
        isDerived: test?.isDerived,
        packageName: t.packageName,
        panelName: t.panelName,
        existingValue: existing?.value || '',
        existingUnit: existing?.unit || '',
        existingFlag: existing?.flag || '',
        existingRemark: existing?.remark || ''
      };
    });

    return successResponse(res, 'Report loaded for entry', {
      report: {
        _id: report._id,
        registrationNumber: report.registrationNumber,
        status: report.status,
        tat: report.tat
      },
      patient: report.patient,
      bill: report.bill,
      testEntries
    });
  } catch (error) {
    next(error);
  }
}

// PUT /reports/:id/results/draft - Save results as draft (status stays Registered)
async function saveResultsDraft(req, res, next) {
  try {
    const { results } = req.body;
    if (!Array.isArray(results) || results.length === 0) {
      return errorResponse(res, 'At least one result is required', 400);
    }
    const report = await reportService.saveResultsDraft(req.params.id, results, req.user);
    await Activity.create({
      user: req.user._id, action: 'Save Results Draft', module: 'Lab',
      description: `Saved ${report.results.length} results as draft for ${report.registrationNumber}.`
    });
    return successResponse(res, 'Results saved as draft', report);
  } catch (error) {
    next(error);
  }
}

// PUT /reports/:id/results/submit - Submit results (status becomes Reported)
async function submitResults(req, res, next) {
  try {
    const { results } = req.body;
    if (!Array.isArray(results) || results.length === 0) {
      return errorResponse(res, 'At least one result is required', 400);
    }
    const report = await reportService.submitResults(req.params.id, results, req.user);
    await Activity.create({
      user: req.user._id, action: 'Submit Results', module: 'Lab',
      description: `Submitted ${report.results.length} results for ${report.registrationNumber}.`
    });
    return successResponse(res, 'Results submitted successfully', report);
  } catch (error) {
    next(error);
  }
}

// ---- Verification workflow + delivery-status ----
// Frontend shapes (ungate banners later):
//   verify/reject/resend/comment -> { report }
//   GET /:id/delivery-status -> { report, deliveryHistory } (newest-first)

async function verifyReport(req, res, next) {
  try {
    const report = await reportService.verifyReport(req.params.id, req.user);
    await Activity.create({
      user: req.user._id, action: 'Verify Report', module: 'Lab',
      description: `Verified report ${report.registrationNumber}.`
    });
    return successResponse(res, 'Report verified', { report });
  } catch (error) {
    next(error);
  }
}

async function rejectReport(req, res, next) {
  try {
    const report = await reportService.rejectReport(req.params.id, req.body && req.body.reason, req.user);
    await Activity.create({
      user: req.user._id, action: 'Reject Report', module: 'Lab',
      description: `Rejected report ${report.registrationNumber}: ${report.rejectReason}`
    });
    return successResponse(res, 'Report rejected', { report });
  } catch (error) {
    next(error);
  }
}

async function resendReport(req, res, next) {
  try {
    const report = await reportService.resendReport(req.params.id, req.user);
    await Activity.create({
      user: req.user._id, action: 'Resend Report', module: 'Lab',
      description: `Re-queued rejected report ${report.registrationNumber} (resend #${report.resendCount}).`
    });
    return successResponse(res, 'Report re-queued for entry', { report });
  } catch (error) {
    next(error);
  }
}

async function addReportComment(req, res, next) {
  try {
    const report = await reportService.addComment(req.params.id, req.body && req.body.body, req.user);
    await Activity.create({
      user: req.user._id, action: 'Comment Report', module: 'Lab',
      description: `Commented on report ${report.registrationNumber}.`
    });
    return successResponse(res, 'Comment added', { report });
  } catch (error) {
    next(error);
  }
}

async function getDeliveryStatus(req, res, next) {
  try {
    const { report, deliveryHistory } = await reportService.getDeliveryHistory(req.params.id);
    return successResponse(res, 'Delivery status loaded', { report, deliveryHistory });
  } catch (error) {
    next(error);
  }
}
