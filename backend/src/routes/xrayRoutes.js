const express = require('express');
const router = express.Router();
const xrayController = require('../controllers/xrayController');
const { protect } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimitMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(protect);

router.get('/', xrayController.getXrayCases);
router.post('/:id/file', requirePermission('reports'), uploadLimiter, upload.single('file'), xrayController.uploadXrayReport);
router.get('/:id/file', xrayController.downloadXrayReport);
router.get('/:id/pdf', require('../controllers/narrativePdfController').forModel(require('../models/XrayCase'), 'X-RAY'));
router.get('/:id', xrayController.getXrayCaseById);
router.post('/', requirePermission('reports'), uploadLimiter, upload.single('file'), xrayController.createXrayCase);
router.put('/:id', requirePermission('reports'), uploadLimiter, upload.single('file'), xrayController.updateXrayCase);

module.exports = router;
