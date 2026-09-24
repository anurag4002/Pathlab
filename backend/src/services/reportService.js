const Report = require('../models/Report');
const Patient = require('../models/Patient');
const Bill = require('../models/Bill');
const Test = require('../models/Test');
const storageService = require('./storageService');
const { derive, evaluateResult } = require('./formulaService');
const { newPublicToken } = require('./qrService');
const { JWT_SECRET } = require('../config/environment');

const durationToDates = (duration) => {
  const now = new Date();
  const end = new Date(); end.setHours(23, 59, 59, 999);
  let start = null;
  const d = String(duration || '').toLowerCase();
  if (d.includes('7')) { start = new Date(); start.setDate(now.getDate() - 6); }
  else if (d.includes('30')) { start = new Date(); start.setDate(now.getDate() - 29); }
  else if (d.includes('90')) { start = new Date(); start.setDate(now.getDate() - 89); }
  if (start) start.setHours(0, 0, 0, 0);
  return { start, end };
};

const getReports = async (filters = {}) => {
  const query = {};
  const Patient = require('../models/Patient');
  const Bill = require('../models/Bill');

  if (filters.patientId) query.patient = filters.patientId;
  if (filters.billId) query.bill = filters.billId;

  if (filters.registrationNumber || filters.regNo) {
    const v = filters.registrationNumber || filters.regNo;
    query.registrationNumber = { $regex: String(v), $options: 'i' };
  }
  // Labsmart §16: 8 filters + test dropdown + CC + shareable URLs
  if (filters.status) query.status = filters.status;
  if (filters.uhid) query.uhid = { $regex: String(filters.uhid), $options: 'i' };
  if (filters.dailyCaseNo) query.dailyCaseNo = { $regex: String(filters.dailyCaseNo), $options: 'i' };
  if (filters.cc) query.cc = String(filters.cc);
  if (filters.test) query.test = filters.test;
  if (filters.firstName) {
    const matched = await Patient.find({ name: { $regex: String(filters.firstName), $options: 'i' } }).select('_id');
    query.patient = query.patient || { $in: matched.map((m) => m._id) };
  }
  if (filters.referredBy) {
    const bills = await Bill.find({ referringDoctor: filters.referredBy }).select('_id');
    query.bill = query.bill || { $in: bills.map((b) => b._id) };
  }
  if (filters.duration && !filters.from && !filters.to && !filters.startDate && !filters.endDate) {
    const { start, end } = durationToDates(filters.duration);
    if (start) query.reportDate = { $gte: start, $lte: end };
  }
  const from = filters.from || filters.startDate;
  const to = filters.to || filters.endDate;
  if (from || to) {
    query.reportDate = query.reportDate || {};
    if (from) query.reportDate.$gte = new Date(from);
    if (to) { const e = new Date(to); e.setHours(23, 59, 59, 999); query.reportDate.$lte = e; }
  }
  if (filters.search) {
    const s = String(filters.search);
    const matched = await Patient.find({
      $or: [{ name: { $regex: s, $options: 'i' } }, { phone: { $regex: s, $options: 'i' } }, { registrationNumber: { $regex: s, $options: 'i' } }]
    }).select('_id');
    query.$or = [
      { registrationNumber: { $regex: s, $options: 'i' } },
      { uhid: { $regex: s, $options: 'i' } },
      { dailyCaseNo: { $regex: s, $options: 'i' } },
      ...(matched.length ? [{ patient: { $in: matched.map((m) => m._id) } }] : [])
    ];
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const reports = await Report.find(query)
    .populate('patient', 'name registrationNumber phone')
    .populate('bill', 'billNumber totalAmount paidAmount dueAmount')
    .populate('test', 'name code')
    .populate('uploadedBy', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Report.countDocuments(query);

  return {
    reports,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

const createReport = async (reportData, file, user) => {
  const { patient, bill, test } = reportData;

  const patientRecord = await Patient.findById(patient);
  if (!patientRecord) {
    throw new Error('Patient not found');
  }

  const billRecord = await Bill.findById(bill);
  if (!billRecord) {
    throw new Error('Bill invoice not found');
  }

  // File path relative to client server base
  const fileUrl = `uploads/reports/${file.filename}`;

  const report = new Report({
    patient,
    registrationNumber: patientRecord.registrationNumber,
    bill,
    test: test || null,
    fileUrl,
    uploadedBy: user._id,
    status: 'Completed'
  });

  return await report.save();
};

const deleteReport = async (id) => {
  const report = await Report.findById(id);
  if (!report) {
    throw new Error('Report not found');
  }

  // Delete physical file (resolved via storage root, subfolder-preserving)
  if (report.fileUrl) {
    await storageService.deleteFile(report.fileUrl);
  }

  return await Report.findByIdAndDelete(id);
};

// ---- Result entry (Labsmart parity) ----

// Register an empty result shell (status Registered, TAT started).
const createResultReport = async ({ patient, bill }, user) => {
  const patientRecord = await Patient.findById(patient);
  if (!patientRecord) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  const billRecord = await Bill.findById(bill);
  if (!billRecord) throw Object.assign(new Error('Bill invoice not found'), { statusCode: 404 });
  const report = new Report({
    patient,
    registrationNumber: patientRecord.registrationNumber,
    bill,
    test: null,
    fileUrl: '',
    uploadedBy: user._id,
    status: 'Registered',
    tat: { registered: new Date(), collected: null, received: null, reported: null },
    results: []
  });
  return await report.save();
};

// Save entered results: runs formula engine, evaluates abnormal flags
// against Test normals + patient age/sex, stamps TAT, marks Reported.
const saveResults = async (reportId, entries = [], user) => {
  const report = await Report.findById(reportId).populate('patient');
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 });

  const patient = report.patient || {};
  const testIds = entries.map((e) => e.test).filter(Boolean);
  const tests = await Test.find({ _id: { $in: testIds } });
  const byId = {};
  tests.forEach((t) => { byId[String(t._id)] = t; });

  // Entered values keyed by test name/code for the formula engine.
  const valueMap = {};
  entries.forEach((e) => {
    const t = e.test ? byId[String(e.test)] : null;
    const key = (t && (t.code || t.name)) || e.testName;
    if (key) valueMap[key] = e.value;
    if (t && t.name) valueMap[t.name] = e.value;
  });

  const { derived } = derive(valueMap, { age: patient.age, gender: patient.gender });

  const buildRow = (test, testName, value, unit, isDerived) => {
    const ev = evaluateResult(value, test, { age: patient.age, gender: patient.gender });
    return {
      test: test ? test._id : null,
      testName: testName || (test && test.name) || '',
      value: value === undefined || value === null ? '' : String(value),
      unit: unit || (test && test.unit) || '',
      flag: ev.flag,
      derived: !!isDerived
    };
  };

  const rows = entries.map((e) => {
    const t = e.test ? byId[String(e.test)] : null;
    return buildRow(t, e.testName, e.value, e.unit, false);
  });
  derived.forEach((d) => {
    rows.push(buildRow(null, d.testName, d.value, d.unit, true));
  });

  report.results = rows;
  report.tat = report.tat || {};
  if (!report.tat.received) report.tat.received = new Date();
  report.tat.reported = new Date();
  report.status = 'Reported';
  await report.save();
  return report;
};

const signReport = async (reportId, signatureId, user) => {
  const report = await Report.findById(reportId);
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 });
  if (!report.results || report.results.length === 0) {
    throw Object.assign(new Error('Enter results before signing'), { statusCode: 400 });
  }
  report.signatures.push({ signature: signatureId || null, signedBy: user._id, signedAt: new Date() });
  report.status = 'Signed';
  await report.save();
  return report;
};

const updateTat = async (reportId, { collected, received }) => {
  const report = await Report.findById(reportId);
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 });
  report.tat = report.tat || {};
  if (collected) report.tat.collected = new Date(collected);
  if (received) report.tat.received = new Date(received);
  if (report.status === 'Registered' && (collected || received)) report.status = 'Received';
  await report.save();
  return report;
};

const ensureQrToken = async (report) => {
  if (report.qrToken) return report.qrToken;
  report.qrToken = newPublicToken(JWT_SECRET);
  await report.save();
  return report.qrToken;
};

// Save entered results as draft (status stays Registered)
const saveResultsDraft = async (reportId, entries = [], user) => {
  const report = await Report.findById(reportId).populate('patient');
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 });

  const patient = report.patient || {};
  const testIds = entries.map((e) => e.test).filter(Boolean);
  const tests = await Test.find({ _id: { $in: testIds } });
  const byId = {};
  tests.forEach((t) => { byId[String(t._id)] = t; });

  const valueMap = {};
  entries.forEach((e) => {
    const t = e.test ? byId[String(e.test)] : null;
    const key = (t && (t.code || t.name)) || e.testName;
    if (key) valueMap[key] = e.value;
    if (t && t.name) valueMap[t.name] = e.value;
  });

  const { derived } = derive(valueMap, { age: patient.age, gender: patient.gender });

  const buildRow = (test, testName, value, unit, isDerived) => {
    const ev = evaluateResult(value, test, { age: patient.age, gender: patient.gender });
    return {
      test: test ? test._id : null,
      testName: testName || (test && test.name) || '',
      value: value === undefined || value === null ? '' : String(value),
      unit: unit || (test && test.unit) || '',
      flag: ev.flag,
      derived: !!isDerived
    };
  };

  const rows = entries.map((e) => {
    const t = e.test ? byId[String(e.test)] : null;
    return buildRow(t, e.testName, e.value, e.unit, false);
  });
  derived.forEach((d) => {
    rows.push(buildRow(null, d.testName, d.value, d.unit, true));
  });

  report.results = rows;
  report.tat = report.tat || {};
  if (!report.tat.received) report.tat.received = new Date();
  // Keep status as Registered for draft
  if (report.status === 'Registered') report.status = 'Draft';
  await report.save();
  return report;
};

// Submit entered results (status becomes Reported)
const submitResults = async (reportId, entries = [], user) => {
  const report = await Report.findById(reportId).populate('patient');
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 });

  const patient = report.patient || {};
  const testIds = entries.map((e) => e.test).filter(Boolean);
  const tests = await Test.find({ _id: { $in: testIds } });
  const byId = {};
  tests.forEach((t) => { byId[String(t._id)] = t; });

  const valueMap = {};
  entries.forEach((e) => {
    const t = e.test ? byId[String(e.test)] : null;
    const key = (t && (t.code || t.name)) || e.testName;
    if (key) valueMap[key] = e.value;
    if (t && t.name) valueMap[t.name] = e.value;
  });

  const { derived } = derive(valueMap, { age: patient.age, gender: patient.gender });

  const buildRow = (test, testName, value, unit, isDerived) => {
    const ev = evaluateResult(value, test, { age: patient.age, gender: patient.gender });
    return {
      test: test ? test._id : null,
      testName: testName || (test && test.name) || '',
      value: value === undefined || value === null ? '' : String(value),
      unit: unit || (test && test.unit) || '',
      flag: ev.flag,
      derived: !!isDerived
    };
  };

  const rows = entries.map((e) => {
    const t = e.test ? byId[String(e.test)] : null;
    return buildRow(t, e.testName, e.value, e.unit, false);
  });
  derived.forEach((d) => {
    rows.push(buildRow(null, d.testName, d.value, d.unit, true));
  });

  report.results = rows;
  report.tat = report.tat || {};
  if (!report.tat.received) report.tat.received = new Date();
  report.tat.reported = new Date();
  report.status = 'Reported';
  await report.save();
  return report;
};

// ---- Verification workflow (backward-compat) ----
// Frontend shape (ungate banners later):
//   verify/reject/resend/comment -> { report }
//   GET /api/reports/:id/delivery-status -> { report, deliveryHistory }

const errWithCode = (message, statusCode) => Object.assign(new Error(message), { statusCode });

// verifyReport(id, user) — only from Signed/Reported, sets Verified.
// Idempotent: if already Verified, returns as-is.
const verifyReport = async (reportId, user) => {
  const report = await Report.findById(reportId);
  if (!report) throw errWithCode('Report not found', 404);
  if (report.status === 'Verified') return report;
  if (!['Signed', 'Reported'].includes(report.status)) {
    throw errWithCode(`Only Signed or Reported reports can be verified (current: ${report.status})`, 400);
  }
  report.status = 'Verified';
  report.verifiedBy = user ? user._id : null;
  report.verifiedAt = new Date();
  await report.save();
  return report;
};

// rejectReport(id, reason, user) — requires reason min 3 chars.
// Cannot reject an already-Rejected report (400).
const rejectReport = async (reportId, reason, user) => {
  const report = await Report.findById(reportId);
  if (!report) throw errWithCode('Report not found', 404);
  if (report.status === 'Rejected') throw errWithCode('Report is already rejected', 400);
  const clean = String(reason || '').trim();
  if (clean.length < 3) throw errWithCode('Rejection reason must be at least 3 characters', 400);
  report.status = 'Rejected';
  report.rejectedBy = user ? user._id : null;
  report.rejectedAt = new Date();
  report.rejectReason = clean;
  await report.save();
  return report;
};

// resendReport(id, user) — only from Rejected, back to Registered.
// Increments resendCount and clears reject fields.
const resendReport = async (reportId, user) => {
  const report = await Report.findById(reportId);
  if (!report) throw errWithCode('Report not found', 404);
  if (report.status !== 'Rejected') {
    throw errWithCode(`Only Rejected reports can be resent (current: ${report.status})`, 400);
  }
  report.status = 'Registered';
  report.resendCount = (report.resendCount || 0) + 1;
  report.rejectedBy = null;
  report.rejectedAt = null;
  report.rejectReason = '';
  await report.save();
  return report;
};

// addComment(id, body, user) — pushes { author, body, createdAt }.
const addComment = async (reportId, body, user) => {
  const report = await Report.findById(reportId);
  if (!report) throw errWithCode('Report not found', 404);
  const clean = String(body || '').trim();
  if (!clean) throw errWithCode('Comment body is required', 400);
  report.comments = report.comments || [];
  report.comments.push({ author: user ? user._id : null, body: clean, createdAt: new Date() });
  await report.save();
  return report;
};

// getDeliveryHistory(reportId) — attempts newest-first for delivery banner.
const getDeliveryHistory = async (reportId) => {
  const report = await Report.findById(reportId);
  if (!report) throw errWithCode('Report not found', 404);
  let DeliveryAttempt;
  try {
    DeliveryAttempt = require('../models/DeliveryAttempt');
  } catch (e) {
    return { report, deliveryHistory: [] };
  }
  const attempts = await DeliveryAttempt.find({ report: report._id }).sort({ createdAt: -1 });
  return { report, deliveryHistory: attempts };
};

module.exports = {
  getReports,
  createReport,
  deleteReport,
  createResultReport,
  saveResults,
  saveResultsDraft,
  submitResults,
  signReport,
  updateTat,
  ensureQrToken,
  verifyReport,
  rejectReport,
  resendReport,
  addComment,
  getDeliveryHistory
};
