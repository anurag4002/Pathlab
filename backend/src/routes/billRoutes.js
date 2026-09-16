const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(protect);

router.get('/', billController.getBills);
router.get('/:id', billController.getBillById);
router.get('/:id/pdf', billController.billPdfDownload);
router.get('/:id/qr', billController.billQr);
router.get('/:id/barcode.svg', billController.billBarcode);
router.post('/', requirePermission('billing'), billController.createBill);
router.post('/:id/payment', requirePermission('billing'), billController.collectPayment);
router.post('/:id/void', authorize('Admin'), billController.voidBill);

module.exports = router;
