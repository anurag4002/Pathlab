const rateLimit = require('express-rate-limit');

// Tiered rate limiting (every route is covered by at least one tier).
// Tuned for clinics behind a single shared public IP, where every page
// navigation fires a burst of API calls. Each tier is overridable via env
// (e.g. RATE_LIMIT_GENERAL=5000) without a code change:
//   general  2000/15m  all /api traffic (flood protection; health checks skipped)
//   auth       50/15m  staff login / oauth / forgot / email-otp / invite accept
//   verify     30/15m  OTP verification + password reset (attempt counters also apply)
//   otp        15/15m  OTP issuance (SMS/Email spend + abuse guard)
//   public    500/15m  unauthenticated QR verify/download (scrape guard)
//   send      100/15m  credit-spending sends (SMS/WhatsApp/Email)
//   export     60/15m  heavy server CSV exports (up to 5000 rows per call)
//   upload    300/1h   10MB file uploads (disk-fill guard; bulk scanning still fits)

const envMax = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: envMax('RATE_LIMIT_GENERAL', 2000),
  skip: (req) => req.path === '/health' || req.path === '/api/health',
  message: { success: false, message: 'Too many requests, please slow down and retry.' },
  standardHeaders: true,
  legacyHeaders: false
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: envMax('RATE_LIMIT_OTP', 15), // Limit each IP to OTP requests per windowMs
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
  max: envMax('RATE_LIMIT_AUTH', 50),
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
  max: envMax('RATE_LIMIT_VERIFY', 30),
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
  max: envMax('RATE_LIMIT_PUBLIC', 500),
  message: { success: false, message: 'Too many verification requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Credit-spending message sends.
const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: envMax('RATE_LIMIT_SEND', 100),
  message: { success: false, message: 'Message send limit reached, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Heavy server-side exports.
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: envMax('RATE_LIMIT_EXPORT', 60),
  message: { success: false, message: 'Export limit reached, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// File uploads (10MB each) — hourly window against disk-fill attacks.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: envMax('RATE_LIMIT_UPLOAD', 300),
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
