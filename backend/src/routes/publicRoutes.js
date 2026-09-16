const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { publicLimiter } = require('../middleware/rateLimitMiddleware');

// Public QR self-service — intentionally NO auth middleware (tier: publicLimiter).
router.get('/r/:token', publicLimiter, publicController.verifyReport);
router.get('/r/:token/download', publicLimiter, publicController.downloadPublicReport);
router.get('/r/bill/:token', publicLimiter, publicController.verifyBill);
router.get('/r/bill/:token/download', publicLimiter, publicController.downloadPublicBill);

module.exports = router;
