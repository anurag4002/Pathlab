const express = require('express');
const router = express.Router();
const usgController = require('../controllers/usgController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', usgController.getUSGCases);
router.get('/templates', usgController.getUSGTemplates);
router.get('/:id', usgController.getUSGCaseById);
router.post('/', usgController.createUSGCase);
router.put('/:id', usgController.updateUSGCase);

module.exports = router;
