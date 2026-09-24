const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Append-only audit trail (Activity collection). Read-only: no edit/delete
// routes exist by design.
router.get('/', protect, authorize('Admin'), auditLogController.listAuditLogs);

module.exports = router;
