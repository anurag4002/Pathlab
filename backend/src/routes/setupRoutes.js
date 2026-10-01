const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadLimiter } = require('../middleware/rateLimitMiddleware');
// Shared hardened upload layer (multer 2.x, memoryStorage + secure limits).
// `upload` enforces the pdf/jpg/png filter (10MB); `logoUpload` enforces the
// image-only 2MB cap. Both buffer in memory and are persisted to disk by the
// controllers via persistRequestFiles() — safe on Vercel serverless (/tmp).
const upload = require('../middleware/uploadMiddleware');
const { logoUpload } = require('../middleware/uploadMiddleware');

const imageUpload = upload; // pdf/jpg/png filter already enforced (10MB)
// Logo-only upload accepts the `logo` field (new) and `file` (legacy form
// key used by the current client).

// Lab profile (centre setup) — Admin only.
router.get('/lab-profile', protect, setupController.getProfile);
router.put('/lab-profile', protect, authorize('Admin'), setupController.updateProfile);
router.patch('/lab-profile', protect, authorize('Admin'), setupController.updateProfile);
router.post('/lab-profile/document-preview', protect, authorize('Admin'), require('../controllers/documentFormatController').preview);
router.post('/lab-profile/logo', protect, authorize('Admin'), uploadLimiter, logoUpload.fields([{ name: 'logo', maxCount: 1 }, { name: 'file', maxCount: 1 }]), setupController.uploadLogoFile);
router.post('/lab-profile/letterhead', protect, authorize('Admin'), uploadLimiter, imageUpload.single('file'), setupController.uploadLetterhead);
router.post('/lab-profile/footer', protect, authorize('Admin'), uploadLimiter, imageUpload.single('file'), setupController.uploadFooter);

// Onboarding checklist — any staff can read, Admin writes.
router.get('/onboarding', protect, setupController.getOnboarding);
router.post('/onboarding', protect, authorize('Admin'), setupController.setOnboardingStep);

// E-signatures — Admin only.
router.get('/signatures', protect, setupController.listSignatures);
router.post('/signatures', protect, authorize('Admin'), uploadLimiter, imageUpload.single('file'), setupController.createSignature);
router.put('/signatures/:id', protect, authorize('Admin'), uploadLimiter, imageUpload.single('file'), setupController.updateSignature);
router.delete('/signatures/:id', protect, authorize('Admin'), setupController.deleteSignature);

// Browser allow-list — Admin only.
router.get('/browsers', protect, authorize('Admin'), setupController.listBrowsers);
router.post('/browsers', protect, authorize('Admin'), setupController.createBrowser);
router.put('/browsers/:id', protect, authorize('Admin'), setupController.setBrowserStatus);
router.delete('/browsers/:id', protect, authorize('Admin'), setupController.deleteBrowser);

module.exports = router;
