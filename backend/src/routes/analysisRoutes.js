const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(protect);

// Finance permission or Admin (Admin implies all inside requirePermission).
router.get('/test-usage', requirePermission('finance'), analysisController.getTestUsage);

module.exports = router;
