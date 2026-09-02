const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', billController.getBills);
router.get('/:id', billController.getBillById);
router.post('/', billController.createBill);
router.post('/:id/payment', billController.collectPayment);

module.exports = router;
