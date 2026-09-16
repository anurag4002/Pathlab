const Report = require('../models/Report');
const Bill = require('../models/Bill');
const LabProfile = require('../models/LabProfile');
const Test = require('../models/Test');
const Signature = require('../models/Signature');
const storageService = require('../services/storageService');
const { verifyPublicToken, reportVerifyUrl, billVerifyUrl } = require('../services/qrService');
const { reportPdf, billPdf } = require('../services/pdfService');
const { qrBuffer } = require('../services/qrService');
const { JWT_SECRET } = require('../config/environment');
const { successResponse, errorResponse } = require('../utils/response');

// Public (no login) QR self-service: status + PDF download.
// Tokens are HMAC-signed; tampered/unknown tokens get a generic 404.

async function findReportByToken(qrToken) {
  if (!verifyPublicToken(qrToken, JWT_SECRET)) return null;
  return Report.findOne({ qrToken }).populate('patient', 'name registrationNumber age gender phone').populate('bill', 'billNumber date totalAmount');
}

async function findBillByToken(qrToken) {
  if (!verifyPublicToken(qrToken, JWT_SECRET)) return null;
  return Bill.findOne({ qrToken }).populate('patient', 'name registrationNumber age gender phone');
}

const verifyReport = async (req, res, next) => {
  try {
    const report = await findReportByToken(req.params.token);
    if (!report) return errorResponse(res, 'Invalid or expired verification link', 404);
    return successResponse(res, 'Report verified', {
      registrationNumber: report.registrationNumber,
      patientName: report.patient ? report.patient.name : '',
      reportDate: report.reportDate,
      status: report.status,
      resultCount: (report.results || []).length,
      hasFile: !!report.fileUrl,
      // Relative to the API base (/api) — the Verify page prefixes apiClient base.
      downloadPath: `/public/r/${report.qrToken}/download`
    });
  } catch (error) {
    next(error);
  }
};

const downloadPublicReport = async (req, res, next) => {
  try {
    const report = await findReportByToken(req.params.token);
    if (!report) return errorResponse(res, 'Invalid or expired verification link', 404);
    // Prefer the uploaded file; otherwise render the server PDF.
    if (report.fileUrl) {
      const abs = storageService.getFilePath(report.fileUrl);
      if (abs) return res.download(abs, `Report_${report.registrationNumber}.pdf`);
    }
    const full = await Report.findById(report._id).populate('patient').populate('bill');
    const testIds = (full.results || []).map((r) => r.test).filter(Boolean);
    const tests = await Test.find({ _id: { $in: testIds } });
    const testMap = {};
    tests.forEach((t) => { testMap[String(t._id)] = t; });
    let profile = null;
    try { profile = await LabProfile.findOne(); } catch (e) { profile = null; }
    const sigIds = (full.signatures || []).map((s) => s.signature).filter(Boolean);
    const sigDocs = sigIds.length ? await Signature.find({ _id: { $in: sigIds } }) : [];
    const sigById = {};
    sigDocs.forEach((s) => { sigById[String(s._id)] = s; });
    const fs = require('fs');
    const signaturePngs = (full.signatures || []).map((s) => {
      const d = sigById[String(s.signature)];
      if (!d || !d.imageUrl) return null;
      const abs = storageService.getFilePath(d.imageUrl);
      if (!abs) return null;
      try { return { png: fs.readFileSync(abs), name: d.name, title: d.title }; } catch (e) { return null; }
    }).filter(Boolean);
    const qrPng = await qrBuffer(reportVerifyUrl(full.qrToken));
    const pdf = await reportPdf({ report: full, patient: full.patient, bill: full.bill, testMap, profile }, { letterhead: true, qrPng, signaturePngs });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Report_${full.registrationNumber}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    next(error);
  }
};

const verifyBill = async (req, res, next) => {
  try {
    const bill = await findBillByToken(req.params.token);
    if (!bill) return errorResponse(res, 'Invalid or expired verification link', 404);
    return successResponse(res, 'Bill verified', {
      billNumber: bill.billNumber,
      patientName: bill.patient ? bill.patient.name : '',
      date: bill.date,
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      dueAmount: bill.dueAmount,
      paymentStatus: bill.paymentStatus,
      voided: !!bill.isVoided
    });
  } catch (error) {
    next(error);
  }
};

const downloadPublicBill = async (req, res, next) => {
  try {
    const bill = await findBillByToken(req.params.token);
    if (!bill) return errorResponse(res, 'Invalid or expired verification link', 404);
    const full = await Bill.findById(bill._id).populate('patient').populate('referringDoctor').populate('agent').populate('items');
    let profile = null;
    try { profile = await LabProfile.findOne(); } catch (e) { profile = null; }
    const qrPng = await qrBuffer(billVerifyUrl(full.qrToken));
    const pdf = await billPdf(
      { bill: full, patient: full.patient, doctor: full.referringDoctor, agent: full.agent, items: full.items, profile },
      { letterhead: true, qrPng }
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Bill_${full.billNumber}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    next(error);
  }
};

module.exports = { verifyReport, downloadPublicReport, verifyBill, downloadPublicBill };
