const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, verifyLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/login', authLimiter, authController.login);
// Google / Facebook sign-in is not offered by the app, so these routes are
// not mounted. Add them back only together with server-side verification of
// the provider's ID token.
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', verifyLimiter, authController.resetPassword);
router.post('/email-otp/request', authLimiter, authController.requestEmailOtp);
router.post('/email-otp/verify', verifyLimiter, authController.verifyEmailOtp);
router.get('/me', protect, authController.getCurrentUser);
router.post('/logout', protect, authController.logout);

module.exports = router;
