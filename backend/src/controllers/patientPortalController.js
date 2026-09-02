const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const Report = require('../models/Report');
const { sendOTP, verifyOTP } = require('../services/otpService');
const { successResponse, errorResponse } = require('../utils/response');
const { JWT_SECRET } = require('../config/environment');

// @desc    Request OTP for patient login
// @route   POST /api/patient/auth/request-otp
// @access  Public
const requestOtp = async (req, res, next) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      return errorResponse(res, 'Mobile number is required', 400);
    }

    // Check if patient exists
    const patient = await Patient.findOne({ phone: mobileNumber });
    if (!patient) {
      // For security, don't reveal if patient exists or not.
      // Or, in a real lab, maybe we do want to tell them.
      // We will pretend we sent it to avoid leaking numbers, or tell them.
      // Let's return error for now so they know they aren't registered.
      return errorResponse(res, 'No patient found with this registered mobile number.', 404);
    }

    await sendOTP(mobileNumber);
    return successResponse(res, 'OTP sent successfully to registered mobile number.');
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and login
// @route   POST /api/patient/auth/verify-otp
// @access  Public
const verifyOtpAndLogin = async (req, res, next) => {
  try {
    const { mobileNumber, otp } = req.body;
    if (!mobileNumber || !otp) {
      return errorResponse(res, 'Mobile number and OTP are required', 400);
    }

    await verifyOTP(mobileNumber, otp);

    const patient = await Patient.findOne({ phone: mobileNumber });
    if (!patient) {
      return errorResponse(res, 'Patient not found', 404);
    }

    // Generate Patient Token
    const token = jwt.sign({ id: patient._id, role: 'PATIENT' }, JWT_SECRET, {
      expiresIn: '2h' // short lived session for security
    });

    return successResponse(res, 'Login successful', {
      token,
      patient: {
        id: patient._id,
        name: patient.name,
        phone: patient.phone
      }
    });
  } catch (error) {
    return errorResponse(res, error.message || 'Invalid OTP', 401);
  }
};

// @desc    Get all reports for authenticated patient
// @route   GET /api/patient/reports
// @access  Private (Patient)
const getPatientReports = async (req, res, next) => {
  try {
    const patientId = req.patient._id;
    // Find all reports associated with this patient
    const reports = await Report.find({ patient: patientId })
      .populate('case')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    return successResponse(res, 'Reports fetched successfully', reports);
  } catch (error) {
    next(error);
  }
};

// @desc    Download a specific report
// @route   GET /api/patient/reports/:id/download
// @access  Private (Patient)
const downloadPatientReport = async (req, res, next) => {
  try {
    const patientId = req.patient._id;
    const reportId = req.params.id;

    const report = await Report.findOne({ _id: reportId, patient: patientId });

    if (!report) {
      return errorResponse(res, 'Report not found or access denied', 404);
    }

    if (!report.fileUrl) {
      return errorResponse(res, 'Report file not available yet', 404);
    }

    // In a real app with S3, this would return a signed URL or stream the file.
    // For local dev, we assume fileUrl is a path we can serve or redirect to.
    return successResponse(res, 'Report ready for download', {
      fileUrl: report.fileUrl
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestOtp,
  verifyOtpAndLogin,
  getPatientReports,
  downloadPatientReport
};
