const jwt = require('jsonwebtoken');
const path = require('path');
const Patient = require('../models/Patient');
const Report = require('../models/Report');
const USGCase = require('../models/USGCase');
const XrayCase = require('../models/XrayCase');
const Test = require('../models/Test');
const TestPackage = require('../models/TestPackage');
const Inquiry = require('../models/Inquiry');
const generateRegistrationNumber = require('../utils/generateRegistrationNumber');
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

    // Never block login: OTP is issued for any valid number. New visitors
    // (no Patient record yet) create their profile after verification.
    const patientCount = await Patient.countDocuments({ phone: cleanPhone });

    const result = await otpService.requestOtp(cleanPhone);
    return successResponse(res, MESSAGES.PATIENT_PORTAL.OTP_SENT, {
      ...result,
      isNew: patientCount === 0
    });
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
      patients,
      isNew: patients.length === 0
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

// ---- Self-service registration + booking inquiries (no payment) ----

// POST /api/patient/register — create the caller's own patient profile
// after OTP verification. One phone may own several profiles (family).
const registerPatient = async (req, res, next) => {
  try {
    const phone = req.patientPhone;
    const { name, age, gender, address } = req.body || {};
    if (!name || !String(name).trim()) {
      return errorResponse(res, 'Full name is required', 400);
    }
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 130) {
      return errorResponse(res, 'Valid age is required', 400);
    }
    if (!['Male', 'Female', 'Other'].includes(gender)) {
      return errorResponse(res, 'Gender must be Male, Female or Other', 400);
    }
    const registrationNumber = await generateRegistrationNumber();
    const patient = await Patient.create({
      registrationNumber,
      name: String(name).trim(),
      age: Math.floor(ageNum),
      gender,
      phone,
      address: address ? String(address).trim() : ''
    });
    return successResponse(res, 'Profile created', patient, 201);
  } catch (error) {
    // Duplicate registration number (parallel self-registers): retry once.
    if (error && error.code === 11000) {
      try {
        const { name, age, gender, address } = req.body || {};
        const retry = await Patient.create({
          registrationNumber: await generateRegistrationNumber(),
          name: String(name).trim(),
          age: Math.floor(Number(age)),
          gender,
          phone: req.patientPhone,
          address: address ? String(address).trim() : ''
        });
        return successResponse(res, 'Profile created', retry, 201);
      } catch (e) { /* fall through */ }
    }
    next(error);
  }
};

// GET /api/patient/catalog — bookable tests + packages (no PHI).
const getCatalog = async (req, res, next) => {
  try {
    const [tests, packages] = await Promise.all([
      Test.find({ status: 'Active' }).select('name code price').sort({ name: 1 }).lean(),
      TestPackage.find({ status: 'Active' }).select('name price').sort({ name: 1 }).lean()
    ]);
    return successResponse(res, 'Catalog loaded', { tests, packages });
  } catch (error) {
    next(error);
  }
};

// POST /api/patient/inquiries — raise a booking inquiry (pay at lab, never
// online: no bill is created and no payment is accepted here).
const createInquiry = async (req, res, next) => {
  try {
    const phone = req.patientPhone;
    const { patientId, name, items, preferredDate, note } = req.body || {};
    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) {
      return errorResponse(res, 'Select at least one test or package to book', 400);
    }
    if (list.length > 20) {
      return errorResponse(res, 'Too many items in one booking (max 20)', 400);
    }
    let patientRef = null;
    let displayName = String(name || '').trim();
    if (patientId) {
      const owned = await Patient.findOne({ _id: patientId, phone }).select('_id name');
      if (!owned) return errorResponse(res, 'Unknown profile for this number', 400);
      patientRef = owned._id;
      if (!displayName) displayName = owned.name;
    }
    if (!displayName) {
      const first = await Patient.findOne({ phone }).select('name');
      displayName = first ? first.name : '';
    }
    if (!displayName) {
      return errorResponse(res, 'Your name is required for the booking', 400);
    }
    const cleanItems = list.slice(0, 20).map((it) => ({
      kind: ['Test', 'Package'].includes(it.kind) ? it.kind : 'Other',
      refId: it.refId || null,
      name: String(it.name || 'Test').slice(0, 120),
      price: Math.max(0, Number(it.price) || 0)
    }));
    let prefDate = null;
    if (preferredDate) {
      const d = new Date(preferredDate);
      if (Number.isNaN(d.getTime())) return errorResponse(res, 'Invalid preferred date', 400);
      prefDate = d;
    }
    const inquiry = await Inquiry.create({
      patient: patientRef,
      name: displayName,
      phone,
      items: cleanItems,
      preferredDate: prefDate,
      note: String(note || '').slice(0, 500),
      status: 'New',
      source: 'portal'
    });
    return successResponse(res, 'Booking inquiry received. Pay at the lab — no online payment needed.', inquiry, 201);
  } catch (error) {
    next(error);
  }
};

// GET /api/patient/inquiries — the caller's own booking inquiries.
const listMyInquiries = async (req, res, next) => {
  try {
    const docs = await Inquiry.find({ phone: req.patientPhone }).sort({ createdAt: -1 }).limit(50).lean();
    return successResponse(res, 'Booking inquiries loaded', docs);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestOtp,
  verifyOtp,
  registerPatient,
  getCatalog,
  createInquiry,
  listMyInquiries,
  getPatientReports,
  getPatientReportById,
  downloadPatientReport
};
