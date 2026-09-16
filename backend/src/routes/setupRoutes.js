const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadLimiter } = require('../middleware/rateLimitMiddleware');
const upload = require('../middleware/uploadMiddleware');

const imageUpload = upload; // pdf/jpg/png filter already enforced (10MB)

// Lab profile (centre setup) — Admin only.
router.get('/lab-profile', protect, setupController.getProfile);
router.put('/lab-profile', protect, authorize('Admin'), setupController.updateProfile);
router.post('/lab-profile/logo', protect, authorize('Admin'), uploadLimiter, imageUpload.single('file'), setupController.uploadLogo);
router.post('/lab-profile/letterhead', protect, authorize('Admin'), uploadLimiter, imageUpload.single('file'), setupController.uploadLetterhead);

// Onboarding checklist — any staff can read, Admin writes.
router.get('/onboarding', protect, setupController.getOnboarding);
router.post('/onboarding', protect, authorize('Admin'), setupController.setOnboardingStep);

// E-signatures — Admin only.
router.get('/signatures', protect, setupController.listSignatures);
router.post('/signatures', protect, authorize('Admin'), uploadLimiter, imageUpload.single('file'), setupController.createSignature);
router.delete('/signatures/:id', protect, authorize('Admin'), setupController.deleteSignature);

// Browser allow-list — Admin only.
router.get('/browsers', protect, authorize('Admin'), setupController.listBrowsers);
router.post('/browsers', protect, authorize('Admin'), setupController.createBrowser);
router.put('/browsers/:id', protect, authorize('Admin'), setupController.setBrowserStatus);
router.delete('/browsers/:id', protect, authorize('Admin'), setupController.deleteBrowser);

module.exports = router;
