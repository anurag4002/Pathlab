const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.get('/google/url', authController.getGoogleAuthUrl);
router.post('/google', authController.googleAuth);
router.get('/facebook/url', authController.getFacebookAuthUrl);
router.post('/facebook', authController.facebookAuth);
router.post('/forgot-password', authController.forgotPassword);
router.get('/me', protect, authController.getCurrentUser);
router.post('/logout', protect, authController.logout);

module.exports = router;
