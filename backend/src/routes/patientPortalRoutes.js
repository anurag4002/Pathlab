const express = require('express');
const router = express.Router();
const patientPortalController = require('../controllers/patientPortalController');
const { protectPatient } = require('../middleware/patientTokenMiddleware');
const { otpLimiter, verifyLimiter } = require('../middleware/rateLimitMiddleware');

// OTP Authentication Routes (Rate limited)
router.post('/auth/request-otp', otpLimiter, patientPortalController.requestOtp);
router.post('/auth/verify-otp', verifyLimiter, patientPortalController.verifyOtp);

// Patient Protected Report Access Routes
router.get('/reports', protectPatient, patientPortalController.getPatientReports);
router.get('/reports/:id', protectPatient, patientPortalController.getPatientReportById);
router.get('/reports/:id/download', protectPatient, patientPortalController.downloadPatientReport);

// Self-service registration + booking inquiries (no payment online).
router.post('/register', protectPatient, patientPortalController.registerPatient);
router.get('/catalog', protectPatient, patientPortalController.getCatalog);
router.post('/inquiries', protectPatient, patientPortalController.createInquiry);
router.get('/inquiries', protectPatient, patientPortalController.listMyInquiries);

module.exports = router;
