const rateLimit = require('express-rate-limit');

// Smart tiered rate limiting (every route is covered by at least one tier):
//   general  300/15m  all /api traffic (flood protection; health checks skipped)
//   auth      20/15m  staff login / oauth / forgot / email-otp / invite accept
//   verify    10/15m  OTP verification + password reset (attempt counters also apply)
//   otp        5/15m  OTP issuance (SMS/Email spend + abuse guard)
//   public   100/15m  unauthenticated QR verify/download (scrape guard)
//   send      30/15m  credit-spending sends (SMS/WhatsApp/Email)
//   export    20/15m  heavy server CSV exports (up to 5000 rows per call)
//   upload   120/1h   10MB file uploads (disk-fill guard; bulk scanning still fits)

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  skip: (req) => req.path === '/health' || req.path === '/api/health',
  message: { success: false, message: 'Too many requests, please slow down and retry.' },
  standardHeaders: true,
  legacyHeaders: false
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 OTP requests per windowMs
  message: {
    success: false,
    message: 'Too many OTP requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Brute-force guard for staff auth (login / forgot / email-otp / oauth).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP verification has its own attempts counter, but still needs IP throttling.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many verification attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Unauthenticated QR self-service (scrape guard, still generous for clinics).
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many verification requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Credit-spending message sends.
const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Message send limit reached, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Heavy server-side exports.
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Export limit reached, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// File uploads (10MB each) — hourly window against disk-fill attacks.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  message: { success: false, message: 'Upload limit reached, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  generalLimiter,
  otpLimiter,
  authLimiter,
  verifyLimiter,
  publicLimiter,
  sendLimiter,
  exportLimiter,
  uploadLimiter
};
