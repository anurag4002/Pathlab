const express = require('express');
const router = express.Router();
const inquiryController = require('../controllers/inquiryController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(authorize('Admin', 'Employee'));

router.get('/', inquiryController.listInquiries);
router.patch('/:id', inquiryController.setInquiryStatus);

module.exports = router;
