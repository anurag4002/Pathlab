const express = require('express');
const router = express.Router();
const modalityController = require('../controllers/modalityController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/', modalityController.listCases);
router.post('/', modalityController.createCase);
router.put('/:id', modalityController.updateCase);
router.delete('/:id', authorize('Admin'), modalityController.deleteCase);

// USG / X-Ray deletes (Admin only)
router.delete('/usg/:id', authorize('Admin'), modalityController.deleteUSGCase);
router.delete('/xray/:id', authorize('Admin'), modalityController.deleteXrayCase);

module.exports = router;
