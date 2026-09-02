const jwt = require('jsonwebtoken');
const path = require('path');
const Patient = require('../models/Patient');
const Report = require('../models/Report');
const USGCase = require('../models/USGCase');
const XrayCase = require('../models/XrayCase');
const otpService = require('../services/otpService');
const storageService = require('../services/storageService');
const { successResponse, errorResponse } = require('../utils/response');
const { JWT_SECRET } = require('../config/environment');
const MESSAGES = require('../constants/messages');

const requestOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.trim().length < 10) {
      return errorResponse(res, 'Please provide a valid 10-digit mobile number', 400);
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // Check if any patient is registered under this phone
    const patientCount = await Patient.countDocuments({ phone: cleanPhone });
    if (patientCount === 0) {
      return errorResponse(res, 'No patient records found for this mobile number. Please check the number or contact Pure Path Lab.', 404);
    }

    const result = await otpService.requestOtp(cleanPhone);
    return successResponse(res, MESSAGES.PATIENT_PORTAL.OTP_SENT, result);
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return errorResponse(res, 'Mobile number and OTP are required', 400);
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const result = await otpService.verifyOtp(cleanPhone, otp);

    if (!result.success) {
      return errorResponse(res, result.message, 400);
    }

    // Issue short-lived patient session token (valid for 2 hours)
    const token = jwt.sign(
      { phone: cleanPhone, role: 'Patient' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const patients = await Patient.find({ phone: cleanPhone }).select('name registrationNumber gender age');

    return successResponse(res, MESSAGES.PATIENT_PORTAL.OTP_VERIFIED, {
      token,
      phone: cleanPhone,
      patients
    });
  } catch (error) {
    next(error);
  }
};

const getPatientReports = async (req, res, next) => {
  try {
    const phone = req.patientPhone;

    // Find all patients registered with this phone number
    const patients = await Patient.find({ phone });
    if (!patients.length) {
      return successResponse(res, MESSAGES.PATIENT_PORTAL.NO_REPORTS, []);
    }

    const patientIds = patients.map(p => p._id);

    // 1. Fetch Laboratory Reports
    const labReports = await Report.find({ patient: { $in: patientIds } })
      .populate('patient', 'name registrationNumber age gender')
      .populate('test', 'name code category referenceRange unit')
      .populate('bill', 'billNumber totalAmount paidAmount dueAmount')
      .sort({ createdAt: -1 });

    // 2. Fetch USG Reports
    const usgReports = await USGCase.find({ patient: { $in: patientIds } })
      .populate('patient', 'name registrationNumber age gender')
      .populate('referringDoctor', 'name')
      .sort({ date: -1 });

    // 3. Fetch X-Ray Reports
    const xrayReports = await XrayCase.find({ patient: { $in: patientIds } })
      .populate('patient', 'name registrationNumber age gender')
      .populate('referringDoctor', 'name')
      .sort({ date: -1 });

    // Format into unified response list
    const reports = [
      ...labReports.map(r => ({
        id: r._id,
        type: 'Pathology',
        testName: r.test ? r.test.name : 'Laboratory Diagnostic Report',
        testCode: r.test ? r.test.code : 'LAB',
        patientName: r.patient ? r.patient.name : 'N/A',
        registrationNumber: r.registrationNumber,
        billNumber: r.bill ? r.bill.billNumber : 'N/A',
        date: r.reportDate,
        status: r.status || 'Completed',
        hasFile: !!r.fileUrl,
        resultValue: r.resultValue,
        unit: r.unit || (r.test ? r.test.unit : ''),
        referenceRange: r.referenceRange || (r.test ? r.test.referenceRange : ''),
        interpretation: r.interpretation,
        notes: r.notes
      })),
      ...usgReports.map(u => ({
        id: u._id,
        type: 'USG',
        testName: u.templateName || 'Ultrasound (USG) Scan',
        testCode: 'USG',
        patientName: u.patient ? u.patient.name : 'N/A',
        registrationNumber: u.patient ? u.patient.registrationNumber : 'N/A',
        doctorName: u.referringDoctor ? u.referringDoctor.name : 'Self',
        date: u.date,
        status: u.status || 'Completed',
        hasFile: false,
        findings: u.findings,
        impression: u.impression
      })),
      ...xrayReports.map(x => ({
        id: x._id,
        type: 'Digital X-Ray',
        testName: 'Digital Radiography (X-Ray)',
        testCode: 'XRAY',
        patientName: x.patient ? x.patient.name : 'N/A',
        registrationNumber: x.patient ? x.patient.registrationNumber : 'N/A',
        doctorName: x.referringDoctor ? x.referringDoctor.name : 'Self',
        date: x.date,
        status: x.status || 'Completed',
        hasFile: !!x.fileUrl,
        findings: x.findings,
        impression: x.impression
      }))
    ];

    return successResponse(res, 'Patient reports loaded successfully', reports);
  } catch (error) {
    next(error);
  }
};

const getPatientReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const phone = req.patientPhone;

    const patients = await Patient.find({ phone }).select('_id');
    const patientIds = patients.map(p => p._id.toString());

    // Search Lab Reports
    const labReport = await Report.findById(id)
      .populate('patient', 'name registrationNumber age gender')
      .populate('test', 'name code category referenceRange unit interpretation')
      .populate('bill', 'billNumber');

    if (labReport && patientIds.includes(labReport.patient._id.toString())) {
      return successResponse(res, 'Report details retrieved', {
        id: labReport._id,
        type: 'Pathology',
        testName: labReport.test ? labReport.test.name : 'Laboratory Diagnostic Report',
        testCode: labReport.test ? labReport.test.code : 'LAB',
        patientName: labReport.patient.name,
        registrationNumber: labReport.registrationNumber,
        billNumber: labReport.bill ? labReport.bill.billNumber : 'N/A',
        date: labReport.reportDate,
        status: labReport.status || 'Completed',
        resultValue: labReport.resultValue,
        unit: labReport.unit || (labReport.test ? labReport.test.unit : ''),
        referenceRange: labReport.referenceRange || (labReport.test ? labReport.test.referenceRange : ''),
        interpretation: labReport.interpretation || (labReport.test ? labReport.test.interpretation : ''),
        notes: labReport.notes,
        hasFile: !!labReport.fileUrl
      });
    }

    // Search USG Reports
    const usgReport = await USGCase.findById(id)
      .populate('patient', 'name registrationNumber age gender')
      .populate('referringDoctor', 'name');

    if (usgReport && patientIds.includes(usgReport.patient._id.toString())) {
      return successResponse(res, 'USG details retrieved', {
        id: usgReport._id,
        type: 'USG',
        testName: usgReport.templateName || 'Ultrasound Scan',
        patientName: usgReport.patient.name,
        registrationNumber: usgReport.patient.registrationNumber,
        doctorName: usgReport.referringDoctor ? usgReport.referringDoctor.name : 'Self',
        date: usgReport.date,
        status: usgReport.status || 'Completed',
        findings: usgReport.findings,
        impression: usgReport.impression,
        hasFile: false
      });
    }

    // Search X-Ray Reports
    const xrayReport = await XrayCase.findById(id)
      .populate('patient', 'name registrationNumber age gender')
      .populate('referringDoctor', 'name');

    if (xrayReport && patientIds.includes(xrayReport.patient._id.toString())) {
      return successResponse(res, 'X-Ray details retrieved', {
        id: xrayReport._id,
        type: 'Digital X-Ray',
        testName: 'Digital Radiography (X-Ray)',
        patientName: xrayReport.patient.name,
        registrationNumber: xrayReport.patient.registrationNumber,
        doctorName: xrayReport.referringDoctor ? xrayReport.referringDoctor.name : 'Self',
        date: xrayReport.date,
        status: xrayReport.status || 'Completed',
        findings: xrayReport.findings,
        impression: xrayReport.impression,
        hasFile: !!xrayReport.fileUrl
      });
    }

    return errorResponse(res, MESSAGES.PATIENT_PORTAL.REPORT_NOT_FOUND, 404);
  } catch (error) {
    next(error);
  }
};

const downloadPatientReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const phone = req.patientPhone;

    // Verify patient ownership
    const patients = await Patient.find({ phone }).select('_id');
    const patientIds = patients.map(p => p._id.toString());

    let relativeFilePath = null;
    let filename = null;

    // Check in Laboratory Reports
    const labReport = await Report.findById(id);
    if (labReport && patientIds.includes(labReport.patient.toString())) {
      if (labReport.fileUrl) {
        relativeFilePath = labReport.fileUrl;
        filename = `Report_${labReport.registrationNumber}_${id}.pdf`;
      }
    }

    // Check in X-Ray Reports if not found in Lab
    if (!relativeFilePath) {
      const xray = await XrayCase.findById(id);
      if (xray && patientIds.includes(xray.patient.toString())) {
        if (xray.fileUrl) {
          relativeFilePath = xray.fileUrl;
          filename = `XRay_${id}${path.extname(xray.fileUrl)}`;
        }
      }
    }

    const absolutePath = storageService.getFilePath(relativeFilePath);
    if (!absolutePath) {
      return errorResponse(res, MESSAGES.PATIENT_PORTAL.REPORT_NOT_FOUND, 404);
    }

    return res.download(absolutePath, filename);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestOtp,
  verifyOtp,
  getPatientReports,
  getPatientReportById,
  downloadPatientReport
};
