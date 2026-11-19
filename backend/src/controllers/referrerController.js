// Referring doctor's own API (/api/referrer). A 'Referrer' login sees only
// the bills, reports and scans where "Referred by" is the Doctor record(s)
// linked to it. Every id from the client is checked against that on the
// server; nothing here edits a bill, a patient or a result.
const fs = require('fs');
const Bill = require('../models/Bill');
require('../models/BillItem');
const Doctor = require('../models/Doctor');
const Inquiry = require('../models/Inquiry');
const Patient = require('../models/Patient');
const Report = require('../models/Report');
const USGCase = require('../models/USGCase');
const XrayCase = require('../models/XrayCase');
const ModalityCase = require('../models/ModalityCase');
const { successResponse, errorResponse } = require('../utils/response');
const { escapeRegex } = require('../utils/escapeRegex');
const { rangeStart, rangeEndOfDay } = require('../utils/dateRange');
const { SIGNED_OFF_STATUSES, ensureQrToken } = require('../services/reportService');
const { ensureBillQrToken } = require('../services/billService');
const { reportVerifyUrl, billVerifyUrl } = require('../services/qrService');
const { forModel } = require('./narrativePdfController');

const OBJECT_ID = /^[a-f\d]{24}$/i;
const NOT_FOUND = 'Not found, or not referred by you.';
const PROCESSING = 'This report is still being processed. It can be opened once the lab signs it.';

// ---- Scope ----

// Runs on every referrer request: the Doctor record(s) this login belongs to.
const loadScope = async (req, res, next) => {
  try {
    const doctors = await Doctor.find({ linkedUser: req.user._id }).select('name clinicHospital phone email branch').lean();
    if (!doctors.length) {
      return errorResponse(res, 'Your login is not linked to a doctor yet. Please contact the lab.', 403);
    }
    req.referrer = { doctors, ids: doctors.map((d) => d._id), idSet: new Set(doctors.map((d) => String(d._id))) };
    return next();
  } catch (error) {
    return next(error);
  }
};

const isMine = (req, doctorRef) => !!doctorRef && req.referrer.idSet.has(String(doctorRef._id || doctorRef));

// A bill is theirs when "Referred by" is them and it was not voided.
const findOwnBill = async (req, id, select = '_id referringDoctor isVoided') => {
  if (!OBJECT_ID.test(String(id || ''))) return null;
  const bill = await Bill.findById(id).select(select);
  if (!bill || bill.isVoided || !isMine(req, bill.referringDoctor)) return null;
  return bill;
};

const isFinalReport = (report) => SIGNED_OFF_STATUSES.includes(report.status);

const SCANS = {
  usg: { Model: USGCase, department: 'USG', label: 'USG report' },
  xray: { Model: XrayCase, department: 'X-RAY', label: 'X-ray report' },
  modality: { Model: ModalityCase, department: 'REPORT', label: 'Scan report' }
};
const scanLabel = (kind, scan) => (kind === 'modality' && scan.modality ? `${scan.modality} report` : SCANS[kind].label);
// USG / X-ray are done when Completed with a report written or uploaded;
// other scans when signed.
const isFinalScan = (kind, scan) => {
  if (kind === 'modality') return scan.status === 'Signed';
  if (scan.status !== 'Completed') return false;
  return !!(String(scan.findings || '').trim() || scan.reportFile?.size || scan.fileUrl);
};
// A scan without its own "Referred by" follows its bill.
const scanIsMine = (req, scan, billIsMine) => (scan.referringDoctor ? isMine(req, scan.referringDoctor) : !!billIsMine);

// ---- Profile ----

const me = async (req, res, next) => {
  try {
    let labName = '';
    try { labName = (await require('../models/LabProfile').findOne().select('labName').lean())?.labName || ''; } catch (e) { labName = ''; }
    return successResponse(res, 'Profile loaded', {
      name: req.user.name,
      labName,
      doctors: req.referrer.doctors.map((d) => ({ _id: d._id, name: d.name, clinicHospital: d.clinicHospital || '' }))
    });
  } catch (error) {
    next(error);
  }
};

// ---- My patients ----

const PATIENT_FIELDS = 'name title age ageUnit gender registrationNumber phone';
const SCAN_FIELDS = {
  usg: 'bill patient referringDoctor status findings reportFile.size serviceType templateName date',
  xray: 'bill patient referringDoctor status findings fileUrl reportFile.size date',
  modality: 'bill patient status modality procedure caseDate'
};

const scanView = (kind, scan) => ({
  kind,
  _id: scan._id,
  label: scanLabel(kind, scan),
  ready: isFinalScan(kind, scan)
});

// GET /api/referrer/cases?search=&from=&to=&page=&limit=
const listCases = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || '').trim().slice(0, 80);
    const { ids } = req.referrer;

    const dateFilter = {};
    const from = rangeStart(req.query.from, null);
    const to = rangeEndOfDay(req.query.to, null);
    if (from && !Number.isNaN(from.getTime())) dateFilter.$gte = from;
    if (to && !Number.isNaN(to.getTime())) dateFilter.$lte = to;

    const query = { referringDoctor: { $in: ids }, isVoided: { $ne: true } };
    if (Object.keys(dateFilter).length) query.date = dateFilter;
    let patientIds = null;
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: 'i' };
      patientIds = await Patient.find({ $or: [{ name: pattern }, { registrationNumber: pattern }, { phone: pattern }] }).select('_id').limit(500).lean().then((rows) => rows.map((p) => p._id));
      const BillItem = require('../models/BillItem');
      const itemBills = await BillItem.distinct('billId', { name: pattern });
      query.$or = [{ patient: { $in: patientIds } }, { billNumber: pattern }, { _id: { $in: itemBills } }];
    }

    const [bills, total] = await Promise.all([
      Bill.find(query)
        .select('billNumber date department patient items referringDoctor totalAmount paidAmount dueAmount discount paymentStatus')
        .populate('patient', PATIENT_FIELDS)
        .populate('items', 'name itemType itemId reportDepartment')
        .populate('referringDoctor', 'name')
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Bill.countDocuments(query)
    ]);
    const billIds = bills.map((b) => b._id);
    const [reports, ...scanLists] = await Promise.all([
      Report.find({ bill: { $in: billIds } }).select('bill status entryMode reportDate fileUrl files').sort({ createdAt: 1 }).lean(),
      ...Object.keys(SCANS).map((kind) => SCANS[kind].Model.find({ bill: { $in: billIds } }).select(SCAN_FIELDS[kind]).lean())
    ]);

    const { reportTestNames } = require('../utils/billItemModality');
    const rows = bills.map((bill) => {
      const own = reports.filter((r) => String(r.bill) === String(bill._id));
      const labReports = own.map((r) => ({
        kind: 'lab',
        _id: r._id,
        label: own.length > 1 && r.entryMode === 'outsource' ? 'Outside lab report' : 'Lab report',
        ready: isFinalReport(r),
        reportDate: isFinalReport(r) ? r.reportDate : null,
        // Only this report's own tests (mixed bills: in-house vs outsource).
        tests: reportTestNames(r, bill.items),
        files: isFinalReport(r) ? require('../utils/reportFiles').publicFileList(r) : []
      }));
      const scans = Object.keys(SCANS).flatMap((kind, i) => scanLists[i]
        .filter((s) => String(s.bill) === String(bill._id) && s.serviceType !== 'without-report' && scanIsMine(req, s, true))
        .map((s) => scanView(kind, s)));
      return {
        _id: bill._id,
        billNumber: bill.billNumber,
        date: bill.date,
        department: bill.department,
        patient: bill.patient || null,
        doctorName: bill.referringDoctor?.name || '',
        tests: (bill.items || []).map((it) => it && it.name).filter(Boolean),
        totalAmount: bill.totalAmount || 0,
        paidAmount: bill.paidAmount || 0,
        dueAmount: bill.dueAmount || 0,
        discount: bill.discount || 0,
        paymentStatus: bill.paymentStatus || '',
        reports: [...labReports, ...scans]
      };
    });

    // Scans referred by them that are not on one of their bills (scan-only
    // visits recorded without a bill, or a bill under another name).
    let otherScans = [];
    if (page === 1) {
      const scanQuery = (kind) => {
        const q = { referringDoctor: { $in: ids } };
        const dateKey = kind === 'modality' ? 'caseDate' : 'date';
        if (Object.keys(dateFilter).length) q[dateKey] = dateFilter;
        if (patientIds) q.patient = { $in: patientIds };
        return q;
      };
      const lists = await Promise.all(['usg', 'xray'].map((kind) => SCANS[kind].Model.find(scanQuery(kind))
        .select(SCAN_FIELDS[kind]).populate('patient', PATIENT_FIELDS).sort({ date: -1 }).limit(50).lean()));
      const candidates = lists.flatMap((list, i) => list.map((s) => ({ kind: ['usg', 'xray'][i], scan: s })));
      const linkedBills = candidates.map((c) => c.scan.bill).filter(Boolean);
      const billInfo = linkedBills.length ? await Bill.find({ _id: { $in: linkedBills } }).select('referringDoctor isVoided').lean() : [];
      const byId = new Map(billInfo.map((b) => [String(b._id), b]));
      otherScans = candidates.filter(({ scan }) => {
        if (!scan.bill) return true;
        const bill = byId.get(String(scan.bill));
        return bill && !bill.isVoided && !isMine(req, bill.referringDoctor);
      }).filter(({ scan }) => scan.serviceType !== 'without-report')
        .map(({ kind, scan }) => ({ ...scanView(kind, scan), date: scan.date, patient: scan.patient || null, what: scan.templateName || '' }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return successResponse(res, 'Your referred patients', {
      cases: rows,
      otherScans,
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) }
    });
  } catch (error) {
    next(error);
  }
};

// ---- Bill ----

// GET /api/referrer/bills/:id/pdf
const billPdf = async (req, res, next) => {
  try {
    const bill = await findOwnBill(req, req.params.id);
    if (!bill) return errorResponse(res, NOT_FOUND, 404);
    return require('./billController').sendBillPdf(req, res, next, { branchCheck: false });
  } catch (error) {
    next(error);
  }
};

// POST /api/referrer/bills/:id/share -> the same public bill link staff send.
const shareBill = async (req, res, next) => {
  try {
    const bill = await findOwnBill(req, req.params.id, '_id referringDoctor isVoided qrToken');
    if (!bill) return errorResponse(res, NOT_FOUND, 404);
    const token = await ensureBillQrToken(bill);
    return successResponse(res, 'Bill link ready', { verifyUrl: billVerifyUrl(token) });
  } catch (error) {
    next(error);
  }
};

// ---- Lab report ----

// The report must belong to one of their bills and be signed off.
const findOwnFinalReport = async (req, res) => {
  if (!OBJECT_ID.test(String(req.params.id || ''))) { errorResponse(res, NOT_FOUND, 404); return null; }
  const report = await Report.findById(req.params.id).select('bill status fileUrl files registrationNumber qrToken updatedAt');
  if (!report || !(await findOwnBill(req, report.bill))) { errorResponse(res, NOT_FOUND, 404); return null; }
  if (!isFinalReport(report)) { errorResponse(res, PROCESSING, 403); return null; }
  return report;
};

// GET /api/referrer/reports/:id/pdf
const reportPdf = async (req, res, next) => {
  try {
    const report = await findOwnFinalReport(req, res);
    if (!report) return undefined;
    // Same as the public report link: an uploaded report file is sent as is.
    const file = require('../utils/reportFiles').findReportFile(report, req.query?.file);
    if (file) {
      const abs = await require('../services/storageService').ensureFilePath(file.url);
      if (abs && fs.existsSync(abs)) return res.download(abs, `Report_${report.registrationNumber}${require('path').extname(abs) || '.pdf'}`);
    }
    return require('./reportController').sendReportPdf(req, res, next, { branchCheck: false });
  } catch (error) {
    next(error);
  }
};

// POST /api/referrer/reports/:id/share -> the public report link (QR token).
const shareReport = async (req, res, next) => {
  try {
    const report = await findOwnFinalReport(req, res);
    if (!report) return undefined;
    const token = await ensureQrToken(report);
    return successResponse(res, 'Report link ready', { verifyUrl: reportVerifyUrl(token) });
  } catch (error) {
    next(error);
  }
};

// ---- USG / X-ray / other scans ----

const scanPdfHandlers = Object.fromEntries(Object.entries(SCANS)
  .map(([kind, { Model, department }]) => [kind, forModel(Model, department, { verified: true })]));

// GET /api/referrer/scans/:kind/:id/pdf
const scanPdf = async (req, res, next) => {
  try {
    const kind = String(req.params.kind || '');
    if (!SCANS[kind] || !OBJECT_ID.test(String(req.params.id || ''))) return errorResponse(res, NOT_FOUND, 404);
    const fields = SCAN_FIELDS[kind].split(' ').filter((f) => f !== 'patient' && f !== 'date' && f !== 'caseDate').join(' ');
    const scan = await SCANS[kind].Model.findById(req.params.id).select(fields).lean();
    if (!scan) return errorResponse(res, NOT_FOUND, 404);
    let billIsMine = false;
    if (scan.bill) {
      const bill = await Bill.findById(scan.bill).select('referringDoctor isVoided').lean();
      if (!bill || bill.isVoided) return errorResponse(res, NOT_FOUND, 404);
      billIsMine = isMine(req, bill.referringDoctor);
    }
    if (!scanIsMine(req, scan, billIsMine)) return errorResponse(res, NOT_FOUND, 404);
    if (!isFinalScan(kind, scan)) return errorResponse(res, PROCESSING, 403);
    return scanPdfHandlers[kind](req, res, next);
  } catch (error) {
    next(error);
  }
};

// ---- Patient requests (bookings) ----

// What a doctor can ask for: the lab's active tests, panels and packages.
const CATALOG_KINDS = {
  Test: () => require('../models/Test'),
  Panel: () => require('../models/TestPanel'),
  Package: () => require('../models/TestPackage')
};
const OFFERED = { isDeleted: { $ne: true }, status: { $ne: 'Inactive' } };

// GET /api/referrer/catalog - names only (the lab sets prices when billing).
const catalog = async (req, res, next) => {
  try {
    require('../models/TestCategory');
    const [tests, panels, packages] = await Promise.all([
      CATALOG_KINDS.Test().find({ ...OFFERED, isDerived: { $ne: true } }).select('name code category').populate('category', 'name').sort({ name: 1 }).lean(),
      CATALOG_KINDS.Panel().find(OFFERED).select('name tests category').populate('category', 'name').sort({ name: 1 }).lean(),
      CATALOG_KINDS.Package().find(OFFERED).select('name includedTests').sort({ name: 1 }).lean()
    ]);
    return successResponse(res, 'Tests', [
      ...packages.map((p) => ({ kind: 'Package', refId: p._id, name: p.name, hint: `Package${p.includedTests?.length ? ` · ${p.includedTests.length} tests` : ''}` })),
      ...panels.map((p) => ({ kind: 'Panel', refId: p._id, name: p.name, hint: [p.category?.name, p.tests?.length ? `${p.tests.length} tests` : ''].filter(Boolean).join(' · ') })),
      ...tests.map((t) => ({ kind: 'Test', refId: t._id, name: t.name, hint: [t.code, t.category?.name].filter(Boolean).join(' · ') }))
    ]);
  } catch (error) {
    next(error);
  }
};

const cleanPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return /^\d{10}$/.test(local) ? local : '';
};

// POST /api/referrer/requests
// The doctor asks the lab to see a patient for these tests. It becomes a
// booking on the lab's Bookings screen with "Referred by" set; the lab
// confirms it, makes the bill (lab prices) and enters the results.
const createRequest = async (req, res, next) => {
  try {
    const { name, phone, age, gender, items, note, preferredDate, doctorId } = req.body || {};
    const doctor = doctorId
      ? req.referrer.doctors.find((d) => String(d._id) === String(doctorId))
      : req.referrer.doctors[0];
    if (!doctor) return errorResponse(res, NOT_FOUND, 404);

    const patientName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!patientName) return errorResponse(res, "Enter the patient's name", 400);
    const mobile = cleanPhone(phone);
    if (!mobile) return errorResponse(res, "Enter the patient's 10-digit mobile number", 400);
    let patientAge = null;
    if (age !== undefined && age !== null && String(age).trim() !== '') {
      patientAge = Number(age);
      if (!Number.isInteger(patientAge) || patientAge < 0 || patientAge > 120) return errorResponse(res, 'Enter the age in years (0 to 120)', 400);
    }
    const sex = ['Male', 'Female', 'Other'].includes(gender) ? gender : '';

    const list = Array.isArray(items) ? items : [];
    if (!list.length) return errorResponse(res, 'Choose at least one test or package', 400);
    if (list.length > 20) return errorResponse(res, 'Too many tests in one request (max 20)', 400);
    // Names and prices always come from the lab's own test list.
    const lines = [];
    const seen = new Set();
    for (const it of list) {
      const kind = CATALOG_KINDS[it && it.kind] ? it.kind : 'Test';
      const refId = String(it && it.refId || '');
      if (!OBJECT_ID.test(refId)) return errorResponse(res, 'Choose tests from the list', 400);
      if (seen.has(`${kind}:${refId}`)) continue;
      seen.add(`${kind}:${refId}`);
      const found = await CATALOG_KINDS[kind]().findOne({ _id: refId, ...OFFERED }).select('name price').lean();
      if (!found) return errorResponse(res, 'One of the tests is no longer offered. Please choose again.', 400);
      lines.push({ kind, refId: found._id, name: String(found.name).slice(0, 120), price: Math.max(0, Number(found.price) || 0) });
    }

    let when = null;
    if (preferredDate) {
      when = new Date(preferredDate);
      if (Number.isNaN(when.getTime())) return errorResponse(res, 'Invalid date', 400);
    }

    const recent = await Inquiry.countDocuments({ requestedBy: req.user._id, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    if (recent >= 100) return errorResponse(res, 'Too many requests today. Please call the lab.', 429);

    // The doctor's branch if the lab set one, else the Main branch.
    let branch = null;
    if (doctor.branch) {
      const Branch = require('../models/Branch');
      branch = (await Branch.findById(doctor.branch).select('_id').lean())?._id || null;
    }
    if (!branch) branch = (await require('../utils/ensureBranch').ensureMainBranch())?._id || null;

    const inquiry = await Inquiry.create({
      name: patientName,
      phone: mobile,
      age: patientAge,
      gender: sex,
      items: lines,
      preferredDate: when,
      note: String(note || '').trim().slice(0, 500),
      status: 'New',
      branch,
      source: 'doctor',
      referringDoctor: doctor._id,
      requestedBy: req.user._id
    });
    return successResponse(res, 'Request sent to the lab', requestView(inquiry.toObject()), 201);
  } catch (error) {
    next(error);
  }
};

const requestView = (inq) => ({
  _id: inq._id,
  name: inq.name,
  phone: inq.phone,
  age: inq.age,
  gender: inq.gender,
  tests: (inq.items || []).map((it) => it.name),
  note: inq.note,
  preferredDate: inq.preferredDate,
  status: inq.status,
  createdAt: inq.createdAt
});

// GET /api/referrer/requests - the requests this doctor sent.
const listRequests = async (req, res, next) => {
  try {
    const docs = await Inquiry.find({ referringDoctor: { $in: req.referrer.ids } })
      .select('name phone age gender items note preferredDate status createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return successResponse(res, 'Your requests', docs.map(requestView));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  loadScope,
  me,
  listCases,
  billPdf,
  shareBill,
  reportPdf,
  shareReport,
  scanPdf,
  catalog,
  createRequest,
  listRequests
};
