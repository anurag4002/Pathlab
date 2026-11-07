const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { publicLimiter } = require('../middleware/rateLimitMiddleware');

// Public QR self-service — intentionally NO auth middleware (tier: publicLimiter).
router.get('/r/:token', publicLimiter, publicController.verifyReport);
router.get('/r/:token/download', publicLimiter, publicController.downloadPublicReport);
router.get('/r/bill/:token', publicLimiter, publicController.verifyBill);
router.get('/r/bill/:token/download', publicLimiter, publicController.downloadPublicBill);
// Case + sample Code39 barcodes (public SVG, no auth — bill barcode untouched).
router.get('/bill/:billNumber/barcode', publicLimiter, publicController.billBarcodeByNumber);
router.get('/case/:caseId/barcode', publicLimiter, publicController.caseBarcode);
router.get('/sample/:sampleId/barcode', publicLimiter, publicController.sampleBarcode);

// Lab name, address and contact for the public website (the same details
// printed on every report). Nothing private.
router.get('/lab-info', publicLimiter, publicController.labInfo);
// Price list for the website: names, categories and prices only (cached).
router.get('/catalog', publicLimiter, publicController.priceList);

module.exports = router;
