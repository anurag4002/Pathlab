const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { uploadLimiter } = require('../middleware/rateLimitMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', reportController.getReports);
router.post('/result', requirePermission('reports'), reportController.createResultReport);
router.put('/:id/results', requirePermission('reports'), reportController.saveResults);
router.post('/:id/sign', requirePermission('reports'), reportController.signReport);
router.put('/:id/tat', requirePermission('reports'), reportController.updateTat);
router.get('/:id/pdf', reportController.reportPdfDownload);
router.get('/:id/qr', reportController.reportQr);
router.get('/:id/download', reportController.downloadReport);
router.post('/upload', uploadLimiter, upload.single('file'), reportController.uploadReport);
router.delete('/:id', authorize('Admin'), reportController.deleteReport);

module.exports = router;
