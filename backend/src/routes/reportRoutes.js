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
router.get('/pending-cases', requirePermission('reports'), reportController.getPendingLabCases);
router.get('/:id/entry', requirePermission('reports'), reportController.getReportForEntry);
router.post('/result', requirePermission('reports'), reportController.createResultReport);
router.put('/:id/results', requirePermission('reports'), reportController.saveResults);
router.put('/:id/results/draft', requirePermission('reports'), reportController.saveResultsDraft);
router.put('/:id/results/submit', requirePermission('reports'), reportController.submitResults);
router.post('/:id/sign', requirePermission('reports'), reportController.signReport);
router.post('/:id/verify', requirePermission('reports'), reportController.verifyReport);
router.post('/:id/reject', requirePermission('reports'), reportController.rejectReport);
router.post('/:id/resend', requirePermission('reports'), reportController.resendReport);
router.post('/:id/comments', requirePermission('reports'), reportController.addReportComment);
router.get('/:id/delivery-status', requirePermission('reports'), reportController.getDeliveryStatus);
router.put('/:id/tat', requirePermission('reports'), reportController.updateTat);
router.get('/:id/pdf', reportController.reportPdfDownload);
router.get('/:id/qr', reportController.reportQr);
router.get('/:id/download', reportController.downloadReport);
router.post('/upload', uploadLimiter, upload.single('file'), reportController.uploadReport);
router.delete('/:id', authorize('Admin'), reportController.deleteReport);

module.exports = router;
