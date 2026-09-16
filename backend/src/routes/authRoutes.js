const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, verifyLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/login', authLimiter, authController.login);
router.get('/google/url', authController.getGoogleAuthUrl);
router.post('/google', authLimiter, authController.googleAuth);
router.get('/facebook/url', authController.getFacebookAuthUrl);
router.post('/facebook', authLimiter, authController.facebookAuth);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', verifyLimiter, authController.resetPassword);
router.post('/email-otp/request', authLimiter, authController.requestEmailOtp);
router.post('/email-otp/verify', verifyLimiter, authController.verifyEmailOtp);
router.get('/me', protect, authController.getCurrentUser);
router.post('/logout', protect, authController.logout);

module.exports = router;
