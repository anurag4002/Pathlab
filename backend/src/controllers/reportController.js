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
const { expandTests, resultKey, includeFormulaDependencies } = require('../services/testDefinitions');
const { resolveReferenceRange } = require('../services/referenceRangeService');
const { getResultOptions } = require('../services/resultOptionsService');

const { getBranchFilter, resolveBranchForCreate, assertBranchAccess } = require('../middleware/branchMiddleware');
const { persistRequestFiles } = require('../middleware/uploadMiddleware');

const assertReportAccess = async (req, id) => {
  const doc = await Report.findById(id).select('branch');
  if (!doc) {
    const err = new Error('Report not found');
    err.statusCode = 404;
    throw err;
  }
  assertBranchAccess(req, doc.branch);
  return doc;
};

const getReports = async (req, res, next) => {
  try {
    const branchScope = getBranchFilter(req);
    const filters = {
      ...branchScope,
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
    // memoryStorage (multer 2.x): persist the validated buffer to disk
    // (/tmp/uploads on Vercel, backend/<UPLOAD_DIR> locally) so that
    // `req.file.filename` + storageService keep working unchanged.
    persistRequestFiles(req, 'reports');
    if (!req.file) {
      return errorResponse(res, 'Please upload a file', 400);
    }

    const { patient, bill, test } = req.body;
    if (!patient || !bill) {
      return errorResponse(res, 'Patient ID and Bill ID are required', 400);
    }

    const report = await reportService.createReport(
      { patient, bill, test, branch: resolveBranchForCreate(req, req.body) },
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

/** POST /reports/:id/file — attach PDF/image to an existing (e.g. outsource) report */
const attachReportFile = async (req, res, next) => {
  try {
    persistRequestFiles(req, 'reports');
    if (!req.file) {
      return errorResponse(res, 'Please upload a file', 400);
    }
    await assertReportAccess(req, req.params.id);
    const report = await reportService.attachReportFile(req.params.id, req.file, req.user);
    await Activity.create({
      user: req.user._id,
      action: 'Upload Report',
      module: 'Lab',
      description: `Attached findings file to report ${report.registrationNumber}.`
    });
    return successResponse(res, 'Report file uploaded successfully', report);
  } catch (error) {
    next(error);
  }
};

const downloadReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    await assertReportAccess(req, id);
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
    await assertReportAccess(req, id);
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
  attachReportFile,
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
  previewResults,
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
    const { patient, bill, entryMode } = req.body;
    if (!patient || !bill) return errorResponse(res, 'Patient ID and Bill ID are required', 400);
    const report = await reportService.createResultReport({
      patient,
      bill,
      entryMode,
      branch: resolveBranchForCreate(req, req.body)
    }, req.user);
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
    await assertReportAccess(req, req.params.id);
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
    await assertReportAccess(req, req.params.id);
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
    await assertReportAccess(req, req.params.id);
    const report = await reportService.updateTat(req.params.id, req.body || {});
    return successResponse(res, 'TAT updated', report);
  } catch (error) {
    next(error);
  }
}

// ---- Server-rendered PDF (letterhead toggle) + QR ----

async function loadReportPdfContext(id, req) {
  const report = await Report.findById(id).populate('patient').populate({ path: 'bill', populate: { path: 'referringDoctor', select: 'name' } });
  if (req) assertBranchAccess(req, report ? report.branch : null);
  if (!report) {
    const err = new Error('Report not found');
    err.statusCode = 404;
    throw err;
  }
  const token = await reportService.ensureQrToken(report);
  const testMap = await require('../services/reportPrintSections').loadReportPrintTests(report);
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
    const { reportOptionsFromQuery } = require('../services/pdfService');
    // Per-request flags (?barcode=0&qr=0…) override the stored LabProfile
    // print options; absent flags fall back to the profile defaults.
    const options = reportOptionsFromQuery(req.query);
    const ctx = await loadReportPdfContext(req.params.id, req);
    const qrOff = options.qr !== undefined && ['0', 'false', false].includes(
      typeof options.qr === 'string' ? options.qr.toLowerCase() : options.qr
    );
    const qrPng = qrOff ? null : await qrBuffer(reportVerifyUrl(ctx.token));
    const pdf = await reportPdf(ctx, { ...options, qrPng });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Report-PDF', 'v5-formatted-interpretations');
    res.setHeader('Content-Disposition', `attachment; filename="Report_${ctx.report.registrationNumber}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    next(error);
  }
}

async function reportQr(req, res, next) {
  try {
    await assertReportAccess(req, req.params.id);
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
    const branchScope = getBranchFilter(req);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || req.query.q || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const countOnly = req.query.countOnly === '1' || req.query.countOnly === 'true';

    // In-lab LAB + outsource (OUTSOURCE LAB / OutsourceLabCase) share this queue.
    const deptClause = {
      $or: [
        { department: { $in: ['LAB', 'OUTSOURCE LAB'] } },
        { caseType: 'OutsourceLabCase' }
      ]
    };
    const matchBill = {
      ...branchScope,
      isVoided: { $ne: true },
      $and: [deptClause]
    };

    if (search) {
      const Patient = require('../models/Patient');
      const matchedPatients = await Patient.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { registrationNumber: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').limit(100).lean();
      const patientIds = matchedPatients.map((p) => p._id);
      matchBill.$and.push({
        $or: [
          { billNumber: { $regex: search, $options: 'i' } },
          ...(patientIds.length ? [{ patient: { $in: patientIds } }] : [])
        ]
      });
    }

    // Single pipeline: join reports, keep LAB/outsource bills with no report or draft/registered.
    // Avoids distinct() materializing every report bill id into Node.
    const pendingMatch = (() => {
      if (statusFilter === 'Pending') {
        return { reportCount: 0 };
      }
      if (statusFilter === 'Registered' || statusFilter === 'Draft') {
        return { entryReport: { $elemMatch: { status: statusFilter } } };
      }
      return {
        $or: [
          { reportCount: 0 },
          { 'entryReport.0': { $exists: true } }
        ]
      };
    })();

    const basePipeline = [
      { $match: matchBill },
      {
        $lookup: {
          from: 'reports',
          localField: '_id',
          foreignField: 'bill',
          as: 'reportDocs'
        }
      },
      {
        $lookup: {
          from: 'billitems',
          localField: '_id',
          foreignField: 'billId',
          as: 'itemDocs',
          pipeline: [{ $project: { name: 1, itemType: 1, price: 1, itemId: 1 } }]
        }
      },
      {
        $project: {
          billNumber: 1,
          date: 1,
          patient: 1,
          createdAt: 1,
          department: 1,
          caseType: 1,
          items: '$itemDocs',
          reportDocs: {
            $map: {
              input: '$reportDocs',
              as: 'r',
              in: {
                _id: '$$r._id',
                status: '$$r.status',
                registrationNumber: '$$r.registrationNumber',
                entryMode: { $ifNull: ['$$r.entryMode', 'all'] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          reportCount: { $size: '$reportDocs' },
          entryReport: {
            $filter: {
              input: '$reportDocs',
              as: 'r',
              cond: {
                $in: ['$$r.status', ['Pending', 'Registered', 'Draft', 'Collected', 'Received', 'Reported']]
              }
            }
          }
        }
      },
      { $match: pendingMatch }
    ];

    if (countOnly) {
      const countRows = await Bill.aggregate([
        ...basePipeline,
        { $count: 'total' }
      ]);
      const total = countRows[0]?.total || 0;
      return successResponse(res, 'Pending lab cases loaded', {
        cases: [],
        pagination: { total, page: 1, limit: 1, pages: total > 0 ? 1 : 0 }
      });
    }

    const rows = await Bill.aggregate([
      ...basePipeline,
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'patients',
                localField: 'patient',
                foreignField: '_id',
                as: 'patientDoc',
                pipeline: [
                  { $project: { name: 1, registrationNumber: 1, age: 1, gender: 1, phone: 1 } }
                ]
              }
            },
            {
              $addFields: {
                patient: { $arrayElemAt: ['$patientDoc', 0] },
                reportInfo: {
                  $cond: [
                    { $gt: [{ $size: '$entryReport' }, 0] },
                    { $arrayElemAt: ['$entryReport', 0] },
                    { $literal: { status: 'Pending' } }
                  ]
                }
              }
            },
            {
              $project: {
                billNumber: 1,
                date: 1,
                patient: 1,
                department: 1,
                caseType: 1,
                items: 1,
                reportInfo: 1
              }
            }
          ],
          meta: [{ $count: 'total' }]
        }
      }
    ]);

    const facet = rows[0] || { data: [], meta: [] };
    const total = facet.meta[0]?.total || 0;
    const { reportModesForItems } = require('../utils/billItemModality');

    // One worklist row per open report shell (mixed bills → separate inhouse / outsource actions).
    const data = [];
    for (const bill of facet.data || []) {
      const baseBill = {
        _id: bill._id,
        billNumber: bill.billNumber,
        date: bill.date,
        patient: bill.patient,
        department: bill.department || 'LAB',
        caseType: bill.caseType || 'LabCase',
        items: Array.isArray(bill.items) ? bill.items : []
      };
      const openReports = Array.isArray(bill.entryReport) ? bill.entryReport : [];
      if (openReports.length) {
        for (const r of openReports) {
          data.push({
            bill: baseBill,
            report: {
              _id: r._id,
              status: r.status || 'Registered',
              registrationNumber: r.registrationNumber,
              entryMode: r.entryMode || 'all'
            }
          });
        }
      } else {
        const modes = reportModesForItems(baseBill.items, baseBill);
        for (const mode of modes) {
          data.push({
            bill: baseBill,
            report: { status: 'Pending', entryMode: mode }
          });
        }
      }
    }

    return successResponse(res, 'Pending lab cases loaded', {
      cases: data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 0 }
    });
  } catch (error) {
    next(error);
  }
}

// GET /reports/:id/entry - Get report with full test details for result entry
async function getReportForEntry(req, res, next) {
  try {
    await assertReportAccess(req, req.params.id);
    const report = await Report.findById(req.params.id)
      .populate('patient', 'name registrationNumber age ageUnit gender phone address referringDoctor')
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

    // Resolve tests from bill items — batch package/panel lookups (no N+1).
    const TestPackage = require('../models/TestPackage');
    const TestPanel = require('../models/TestPanel');
    const BillItem = require('../models/BillItem');

    let billItems = (report.bill && Array.isArray(report.bill.items)) ? report.bill.items : [];
    // Fallback when bill.items refs are empty but BillItem rows exist by billId
    if ((!billItems.length || billItems.every((i) => !i || !i.name)) && report.bill?._id) {
      billItems = await BillItem.find({ billId: report.bill._id }).lean();
    }

    // Mixed bill: only lines for this shell's entryMode
    const { isInhouseItem, isOutsourceItem } = require('../utils/billItemModality');
    const mode = report.entryMode || 'all';
    if (mode === 'inhouse') {
      billItems = billItems.filter(isInhouseItem);
    } else if (mode === 'outsource') {
      billItems = billItems.filter(isOutsourceItem);
    }

    let allTests = [];
    const packageIds = [];
    const panelIds = [];
    for (const item of billItems) {
      if (!item) continue;
      if (item.itemType === 'Test' && item.itemId) {
        allTests.push({ type: 'Test', itemId: item.itemId, name: item.name });
      } else if (item.itemType === 'TestPackage' && item.itemId) {
        packageIds.push(item.itemId);
      } else if (item.itemType === 'TestPanel' && item.itemId) {
        panelIds.push(item.itemId);
      } else if (item.itemType === 'Custom' || (!item.itemId && item.name)) {
        // Outsource / typed lines — name only (no catalog test id)
        allTests.push({ type: 'Custom', itemId: null, name: item.name });
      }
    }

    // Also surface tests already saved on the report (edit path)
    for (const r of (report.results || [])) {
      const tid = r.test?._id || r.test;
      const tname = r.testName || r.test?.name;
      if (tid && !allTests.some((t) => String(t.itemId) === String(tid))) {
        allTests.push({ type: 'Test', itemId: tid, name: tname || 'Test' });
      } else if (!tid && !r.derived && tname && !allTests.some((t) => t.name === tname && !t.itemId)) {
        allTests.push({ type: 'Custom', itemId: null, name: tname });
      }
    }

    const [packages, panels] = await Promise.all([
      packageIds.length
        ? TestPackage.find({ _id: { $in: packageIds } }).populate('includedTests', 'name').lean()
        : Promise.resolve([]),
      panelIds.length
        ? TestPanel.find({ _id: { $in: panelIds } }).populate('tests', 'name').lean()
        : Promise.resolve([])
    ]);
    packages.forEach((pkg) => {
      (pkg.includedTests || []).forEach((t) => {
        allTests.push({ type: 'Test', itemId: t._id, name: t.name, packageName: pkg.name });
      });
    });
    panels.forEach((panel) => {
      (panel.tests || []).forEach((t) => {
        allTests.push({ type: 'Test', itemId: t._id, name: t.name, panelName: panel.name });
      });
    });

    // Get full test details
    const testIds = [...new Set(allTests.map(t => t.itemId).filter(Boolean))];
    const catalog = await Test.find().populate('category', 'name').lean();
    const tests = includeFormulaDependencies(catalog.filter((t) => testIds.some((id) => String(id) === String(t._id))), catalog);
    for (const test of tests) {
      if (!allTests.some((t) => String(t.itemId) === String(test._id))) {
        allTests.push({ type: 'Test', itemId: test._id, name: test.name, formulaInput: true });
      }
    }
    const testMap = {};
    tests.forEach(t => { testMap[String(t._id)] = t; });

    // Merge with existing results
    const existingResults = report.results || [];
    const existingResultMap = {};
    existingResults.forEach(r => {
      if (r.test) existingResultMap[resultKey(r.test, r.parameterCode)] = r;
    });

    const testEntries = allTests.flatMap((t) => {
      const parent = t.itemId ? testMap[String(t.itemId)] : null;
      const definitions = parent ? expandTests([parent]) : [null];
      if (parent?.parameters?.length && existingResultMap[resultKey(parent._id)]) definitions.unshift({ ...parent, legacyScalar: true });
      return definitions.map((definition, definitionIndex) => {
      const test = definition ? resolveReferenceRange(definition, report.patient) : null;
      const key = resultKey(t.itemId, test?.parameterCode);
      const existing = t.itemId ? existingResultMap[key] : null;
      // Match name-only saved results for Custom lines
      const existingByName = !existing && t.name
        ? (report.results || []).find((r) => !r.test && r.testName === t.name)
        : null;
      const row = existing || existingByName;
      return {
        testId: t.itemId || null,
        resultKey: t.itemId ? key : `name:${t.name}`,
        parameterCode: test?.parameterCode || '',
        testName: test?.legacyScalar ? `${test.name} (previous entry)` : test?.name || t.name || 'Test',
        testCode: test?.code || '',
        sourceType: test?.sourceType || '',
        displayOrder: test?.displayOrder ?? null,
        category: test?.category,
        categoryName: test?.category?.name || '',
        interpretation: definitionIndex === 0 ? test?.interpretation || '' : '',
        unit: test?.unit || '',
        resultOptions: getResultOptions(test || {}),
        referenceRange: ['Reported', 'Signed', 'Verified', 'Completed'].includes(report.status)
          ? row?.referenceRange || test?.referenceRange || '' : test?.referenceRange || '',
        rangeMissing: test?.rangeMissing || false,
        lowInclusive: test?.lowInclusive,
        highInclusive: test?.highInclusive,
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
        legacyScalar: !!test?.legacyScalar,
        formula: test?.formula || '',
        packageName: t.packageName,
        panelName: t.panelName,
        parentName: test?.parentName || '',
        formulaInput: !!t.formulaInput,
        existingValue: row?.value || '',
        existingUnit: row?.unit || '',
        existingFlag: row?.flag || '',
        existingRemark: row?.remark || ''
      };
      });
    });

    return successResponse(res, 'Report loaded for entry', {
      report: {
        _id: report._id,
        registrationNumber: report.registrationNumber,
        status: report.status,
        entryMode: report.entryMode || 'all',
        tat: report.tat
      },
      patient: report.patient,
      bill: report.bill,
      entryMode: report.entryMode || 'all',
      results: report.results || [],
      testEntries: [...new Map(testEntries.map((test) => [test.resultKey, test])).values()].sort((a,b)=>(a.displayOrder ?? Infinity)-(b.displayOrder ?? Infinity))
    });
  } catch (error) {
    next(error);
  }
}

// Preview uses the same calculation path as save, without changing report state.
async function previewResults(req, res, next) {
  try {
    await assertReportAccess(req, req.params.id);
    const report = await Report.findById(req.params.id).populate('patient');
    if (!report) return errorResponse(res, 'Report not found', 404);
    const entries = req.body?.results;
    if (!Array.isArray(entries) || entries.length > 500 || entries.some((e) => !e || typeof e !== 'object')) {
      return errorResponse(res, 'Results must be an array of at most 500 entries', 400);
    }
    const { calculateReportResults } = require('../services/reportCalculationService');
    return successResponse(res, 'Results calculated', await calculateReportResults(report, entries));
  } catch (error) { next(error); }
}

// PUT /reports/:id/results/draft - Save results as draft (status stays Registered)
async function saveResultsDraft(req, res, next) {
  try {
    await assertReportAccess(req, req.params.id);
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
    await assertReportAccess(req, req.params.id);
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
    await assertReportAccess(req, req.params.id);
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
    await assertReportAccess(req, req.params.id);
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
    await assertReportAccess(req, req.params.id);
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
    await assertReportAccess(req, req.params.id);
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
    await assertReportAccess(req, req.params.id);
    const { report, deliveryHistory } = await reportService.getDeliveryHistory(req.params.id);
    return successResponse(res, 'Delivery status loaded', { report, deliveryHistory });
  } catch (error) {
    next(error);
  }
}
