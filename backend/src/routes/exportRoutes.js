const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { protect } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { exportLimiter } = require('../middleware/rateLimitMiddleware');

router.use(protect);

router.get('/:dataset', requirePermission('finance'), exportLimiter, exportController.exportCsv);

module.exports = router;
