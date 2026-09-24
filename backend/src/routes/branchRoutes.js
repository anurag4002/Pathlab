const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

// Any staff can list branches (needed for display / filters).
// Only Admin can create / update / delete.
router.get('/', branchController.getBranches);
router.post('/', authorize('Admin'), branchController.createBranch);
router.put('/:id', authorize('Admin'), branchController.updateBranch);
router.delete('/:id', authorize('Admin'), branchController.deleteBranch);

module.exports = router;
