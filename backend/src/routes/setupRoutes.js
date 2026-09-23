const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOAD_DIR } = require('../config/environment');
const setupController = require('../controllers/setupController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadLimiter } = require('../middleware/rateLimitMiddleware');
const upload = require('../middleware/uploadMiddleware');

const imageUpload = upload; // pdf/jpg/png filter already enforced (10MB)

// Logo-only upload: images only (jpg/jpeg/png), 2MB cap. Accepts the `logo`
// field (new) and `file` (legacy form key used by the current client).
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const baseDir = process.env.VERCEL
        ? '/tmp/uploads'
        : path.resolve(__dirname, '../../', UPLOAD_DIR);
      const fullPath = path.join(baseDir, 'letterheads');
      if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
      cb(null, fullPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const logoUpload = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.jpg', '.jpeg', '.png'].includes(ext) && String(file.mimetype || '').startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, JPEG, and PNG images are allowed for the logo.'), false);
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB cap
});

// Lab profile (centre setup) — Admin only.
router.get('/lab-profile', protect, setupController.getProfile);
router.put('/lab-profile', protect, authorize('Admin'), setupController.updateProfile);
router.patch('/lab-profile', protect, authorize('Admin'), setupController.updateProfile);
router.post('/lab-profile/logo', protect, authorize('Admin'), uploadLimiter, logoUpload.fields([{ name: 'logo', maxCount: 1 }, { name: 'file', maxCount: 1 }]), setupController.uploadLogoFile);
router.post('/lab-profile/letterhead', protect, authorize('Admin'), uploadLimiter, imageUpload.single('file'), setupController.uploadLetterhead);

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
