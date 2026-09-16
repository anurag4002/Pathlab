const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/tickets', supportController.listTickets);
router.post('/tickets', supportController.createTicket);
router.put('/tickets/:id', authorize('Admin'), supportController.setTicketStatus);

router.get('/subscription', supportController.getSubscription);
router.post('/subscription/plan', authorize('Admin'), supportController.changePlan);
router.post('/subscription/refund', authorize('Admin'), supportController.requestRefund);

module.exports = router;
