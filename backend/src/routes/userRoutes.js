const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(authorize('Admin'));

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.get('/:id/sessions', userController.getUserSessions);
router.post('/:id/revoke-sessions', userController.revokeUserSessions);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
