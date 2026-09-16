const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Fail fast in production when required secrets are missing.
// In development/test we fall back to local-only placeholders with a loud
// warning so `npm run dev` still works without real credentials.
// NOTE: no production credentials may ever be hardcoded here.
let MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  if (isProduction) {
    throw new Error(
      'FATAL: MONGO_URI is not set. Refusing to start in production without an explicit database connection string.'
    );
  }
  MONGO_URI = 'mongodb://127.0.0.1:27017/purepathlab-dev';
  console.warn('[env] MONGO_URI not set — using local dev database. Do not use this in production.');
}

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (isProduction) {
    throw new Error(
      'FATAL: JWT_SECRET is not set. Refusing to start in production without an explicit signing secret.'
    );
  }
  JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me';
  console.warn('[env] JWT_SECRET not set — using insecure dev placeholder. Do not use this in production.');
}

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

module.exports = {
  PORT: process.env.PORT || 5001,
  MONGO_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL,
  // Comma-separated allowlist, e.g. "https://app.example.com,https://admin.example.com".
  // Defaults to CLIENT_URL. Use "*" only for local development, never in production.
  CORS_ORIGIN: process.env.CORS_ORIGIN || CLIENT_URL,
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS !== 'false',
  // Absolute public base used inside QR codes (backend serves /r/:token).
  PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL || CLIENT_URL || '').replace(/\/$/, ''),
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'src/uploads',
  NODE_ENV,
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5,
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 3,
  OTP_DAILY_LIMIT: parseInt(process.env.OTP_DAILY_LIMIT, 10) || 5,
  SMS_PROVIDER: process.env.SMS_PROVIDER || 'console',
  SMS_API_KEY: process.env.SMS_API_KEY || '',
  SMS_SENDER_ID: process.env.SMS_SENDER_ID || 'PUREPATH',
  // WhatsApp Cloud API (fetch-based; unset => console fallback)
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN || '',
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID || '',
  // Email via Brevo HTTP API (fetch-based; unset => console fallback)
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'console',
  EMAIL_API_KEY: process.env.EMAIL_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || '',
  FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID || '',
  FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET || '',
  FACEBOOK_CALLBACK_URL: process.env.FACEBOOK_CALLBACK_URL || ''
};
