const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary', dashboardController.getDashboardSummary);
router.get('/business', dashboardController.getDailyBusinessReport);
router.get('/referral', dashboardController.getReferralReport);
router.get('/activities', dashboardController.getActivityLogs);

module.exports = router;
