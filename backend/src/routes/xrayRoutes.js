const express = require('express');
const router = express.Router();
const xrayController = require('../controllers/xrayController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', xrayController.getXrayCases);
router.get('/:id', xrayController.getXrayCaseById);
router.post('/', upload.single('file'), xrayController.createXrayCase);
router.put('/:id', upload.single('file'), xrayController.updateXrayCase);

module.exports = router;
