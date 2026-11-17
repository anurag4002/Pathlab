const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const referrerAccess = require('../controllers/referrerAccessController');

router.use(protect);

// Referring-doctor logins (Admin): give, reset password, turn off/on.
router.get('/logins', authorize('Admin'), referrerAccess.listLogins);
router.post('/:id/login', authorize('Admin'), referrerAccess.giveLogin);
router.put('/:id/login/password', authorize('Admin'), referrerAccess.resetPassword);
router.patch('/:id/login', authorize('Admin'), referrerAccess.updateLogin);

router.get('/', doctorController.getDoctors);
router.get('/:id', doctorController.getDoctorById);
router.post('/', doctorController.createDoctor);
router.put('/:id', doctorController.updateDoctor);
router.delete('/:id', authorize('Admin'), doctorController.deleteDoctor);

module.exports = router;
