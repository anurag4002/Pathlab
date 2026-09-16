const express = require('express');
const router = express.Router();
const notifyController = require('../controllers/notifyController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { sendLimiter } = require('../middleware/rateLimitMiddleware');

router.use(protect);

router.get('/templates', notifyController.listTemplates);
router.post('/templates', authorize('Admin'), notifyController.upsertTemplate);
router.post('/send', requirePermission('delivery'), sendLimiter, notifyController.sendMessage);
router.get('/credits', notifyController.getCredits);
router.post('/credits/topup', authorize('Admin'), notifyController.topupCredits);
router.get('/reviews', notifyController.listReviews);
router.post('/reviews', requirePermission('delivery'), sendLimiter, notifyController.sendReviewRequest);
router.put('/reviews/:id', notifyController.markReview);

module.exports = router;
