const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/purepathlab',
  JWT_SECRET: process.env.JWT_SECRET || 'purepathlabdefaultsecretkey',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'src/uploads',
  NODE_ENV: process.env.NODE_ENV || 'development',
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES) || 5,
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS) || 3,
  SMS_PROVIDER: process.env.SMS_PROVIDER || 'mock',
  SMS_API_KEY: process.env.SMS_API_KEY || '',
  SMS_SENDER_ID: process.env.SMS_SENDER_ID || ''
};
