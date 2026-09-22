const Report = require('../models/Report');
const Patient = require('../models/Patient');
const Bill = require('../models/Bill');
const Test = require('../models/Test');
const storageService = require('./storageService');
const { derive, evaluateResult } = require('./formulaService');
const { newPublicToken } = require('./qrService');
const { JWT_SECRET } = require('../config/environment');

const getReports = async (filters = {}) => {
  const query = {};

  if (filters.patientId) query.patient = filters.patientId;
  if (filters.billId) query.bill = filters.billId;
  
  if (filters.registrationNumber) {
    query.registrationNumber = { $regex: filters.registrationNumber, $options: 'i' };
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
  ensureQrToken
};
