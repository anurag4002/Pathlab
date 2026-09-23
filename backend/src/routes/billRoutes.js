const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(protect);

router.get('/cashbook', billController.getCashbook);
router.post('/cashbook', requirePermission('finance'), billController.createManualCashEntry);
router.get('/', billController.getBills);
router.get('/:id', billController.getBillById);
router.get('/:id/pdf', billController.billPdfDownload);
router.get('/:id/qr', billController.billQr);
router.get('/:id/barcode.svg', billController.billBarcode);
router.post('/', requirePermission('billing'), billController.createBill);
router.post('/:id/payment', requirePermission('billing'), billController.collectPayment);
router.post('/:id/refund', requirePermission('billing'), billController.refundBill);
router.put('/:id', requirePermission('billing'), billController.updateBill);
router.post('/:id/void', authorize('Admin'), billController.voidBill);

module.exports = router;
