const express = require('express');
const router = express.Router();
const tatConfigController = require('../controllers/tatConfigController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// TAT defaults + thresholds — Admin only. Single-doc pattern (key='default').
// Frontend keeps a localStorage fallback (`ppl.tatConfig`); server values
// override local ones when present.
router.get('/tat', protect, authorize('Admin'), tatConfigController.getTatConfig);
router.put('/tat', protect, authorize('Admin'), tatConfigController.updateTatConfig);

module.exports = router;
