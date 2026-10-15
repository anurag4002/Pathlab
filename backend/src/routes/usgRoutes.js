const express = require('express');
const router = express.Router();
const usgController = require('../controllers/usgController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { uploadLimiter } = require('../middleware/rateLimitMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', usgController.getUSGCases);
router.get('/templates', usgController.getUSGTemplates);
router.get('/services', usgController.getUSGServices);
router.post('/:id/file', requirePermission('reports'), uploadLimiter, upload.single('file'), usgController.uploadUSGReport);
router.get('/:id/file', usgController.downloadUSGReport);
router.get('/:id/pdf', require('../controllers/narrativePdfController').forModel(require('../models/USGCase'), 'USG'));
router.get('/:id', usgController.getUSGCaseById);
router.post('/', usgController.createUSGCase);
router.put('/:id', usgController.updateUSGCase);

module.exports = router;
