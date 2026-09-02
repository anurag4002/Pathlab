const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', reportController.getReports);
router.get('/:id/download', reportController.downloadReport);
router.post('/upload', upload.single('file'), reportController.uploadReport);
router.delete('/:id', authorize('Admin'), reportController.deleteReport);

module.exports = router;
