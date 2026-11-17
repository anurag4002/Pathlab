const express = require('express');
const router = express.Router();
const referrer = require('../controllers/referrerController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Referring doctors only (role 'Referrer'). Read-only views of their own
// referred cases, PDFs of their bills and signed reports, share links, and
// patient requests. Staff use the staff APIs, so they are refused here.
router.use(protect, authorize('Referrer'), referrer.loadScope);

router.get('/me', referrer.me);
router.get('/cases', referrer.listCases);
router.get('/bills/:id/pdf', referrer.billPdf);
router.post('/bills/:id/share', referrer.shareBill);
router.get('/reports/:id/pdf', referrer.reportPdf);
router.post('/reports/:id/share', referrer.shareReport);
router.get('/scans/:kind/:id/pdf', referrer.scanPdf);
router.get('/catalog', referrer.catalog);
router.get('/requests', referrer.listRequests);
router.post('/requests', referrer.createRequest);

module.exports = router;
