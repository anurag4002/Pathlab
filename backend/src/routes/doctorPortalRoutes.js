const express = require('express');
const router = express.Router();
const doctorPortalController = require('../controllers/doctorPortalController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

// Public invite acceptance (rate-limited).
router.post('/invites/accept', authLimiter, doctorPortalController.acceptInvite);

router.use(protect);

// Doctor's own referred cases.
router.get('/cases', doctorPortalController.myCases);

// Invite management — Admin only.
router.get('/invites', authorize('Admin'), doctorPortalController.listInvites);
router.post('/invites', authorize('Admin'), doctorPortalController.createInvite);

module.exports = router;
