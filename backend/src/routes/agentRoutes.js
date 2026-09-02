const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/', agentController.getAgents);
router.get('/:id', agentController.getAgentById);
router.post('/', agentController.createAgent);
router.put('/:id', agentController.updateAgent);
router.delete('/:id', authorize('Admin'), agentController.deleteAgent);

module.exports = router;
