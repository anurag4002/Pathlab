const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const OtpSession = require('../models/OtpSession');
const {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  SMS_PROVIDER
} = require('../config/environment');
const { sendTemplated } = require('./notificationService');

const generateOtp = () => {
  // Crypto-random 6-digit code (Math.random is predictable).
  return (crypto.randomInt(0, 900000) + 100000).toString();
};

const sendOtp = async (phone, otp) => {
  if (SMS_PROVIDER === 'console' || process.env.NODE_ENV === 'development') {
    console.log(`[Pure Path Lab] OTP for ${phone}: ${otp}`);
    return true;
  }

  try {
    const res = await sendTemplated('sms', 'otp', phone, { otp, fallbackText: `Your Pure Path Lab OTP is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.` });
    return res.ok;
  } catch (e) {
    console.error('SMS OTP send failed:', e.message);
    return false;
  }
};

// Generic channel-aware OTP (staff login / forgot-password / patient-auth).
// target: { phone } or { email }. Returns { success, expiresInMinutes }.
const requestOtpFor = async ({ phone, email, channel = 'sms', purpose = 'patient-auth' }) => {
  const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
  const cleanEmail = email ? String(email).toLowerCase().trim() : '';
  if (channel === 'sms' && !cleanPhone) throw Object.assign(new Error('Valid phone number required'), { statusCode: 400 });
  if (channel === 'email' && !cleanEmail) throw Object.assign(new Error('Valid email required'), { statusCode: 400 });

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OtpSession.deleteMany({ phone: cleanPhone, email: cleanEmail, purpose });
  await OtpSession.create({ phone: cleanPhone, email: cleanEmail, channel, purpose, otpHash, expiresAt, attempts: 0, verified: false });

  if (channel === 'email') {
    try {
      const { sendEmailViaProvider } = require('./notificationService');
      // Console fallback prints in dev; real provider in prod.
      await sendEmailViaProvider(cleanEmail, 'Your login OTP', `Your Pure Path Lab OTP is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`);
    } catch (e) {
      console.error('Email OTP send failed:', e.message);
    }
  } else {
    await sendOtp(cleanPhone, otp);
  }

  return { success: true, expiresInMinutes: OTP_EXPIRY_MINUTES };
};

const verifyOtpFor = async ({ phone, email, inputOtp, purpose = 'patient-auth' }) => {
  const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
  const cleanEmail = email ? String(email).toLowerCase().trim() : '';
  const session = await OtpSession.findOne({ phone: cleanPhone, email: cleanEmail, purpose });

  if (!session) {
    return { success: false, message: 'OTP expired or not requested. Please request a new OTP.' };
  }
  if (session.attempts >= OTP_MAX_ATTEMPTS) {
    await OtpSession.deleteOne({ _id: session._id });
    return { success: false, message: 'Maximum verification attempts exceeded. Please request a new OTP.' };
  }
  if (new Date() > session.expiresAt) {
    await OtpSession.deleteOne({ _id: session._id });
    return { success: false, message: 'OTP has expired. Please request a new OTP.' };
  }
  const isMatch = await bcrypt.compare(String(inputOtp), session.otpHash);
  if (!isMatch) {
    session.attempts += 1;
    await session.save();
    const remaining = OTP_MAX_ATTEMPTS - session.attempts;
    return { success: false, message: `Invalid OTP. ${remaining} attempt(s) remaining.` };
  }
  await OtpSession.deleteOne({ _id: session._id });
  return { success: true };
};

const requestOtp = async (phone) => {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const otp = generateOtp();
  const salt = await bcrypt.genSalt(10);
  const otpHash = await bcrypt.hash(otp, salt);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OtpSession.deleteMany({ phone: cleanPhone });

  await OtpSession.create({
    phone: cleanPhone,
    otpHash,
    expiresAt,
    attempts: 0,
    verified: false
  });

  await sendOtp(cleanPhone, otp);

  return {
    success: true,
    expiresInMinutes: OTP_EXPIRY_MINUTES
  };
};

const verifyOtp = async (phone, inputOtp) => {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const session = await OtpSession.findOne({ phone: cleanPhone });

  if (!session) {
    return { success: false, message: 'OTP expired or not requested. Please request a new OTP.' };
  }

  if (session.attempts >= OTP_MAX_ATTEMPTS) {
    await OtpSession.deleteOne({ _id: session._id });
    return { success: false, message: 'Maximum verification attempts exceeded. Please request a new OTP.' };
  }

  if (new Date() > session.expiresAt) {
    await OtpSession.deleteOne({ _id: session._id });
    return { success: false, message: 'OTP has expired. Please request a new OTP.' };
  }

  const isMatch = await bcrypt.compare(inputOtp, session.otpHash);

  if (!isMatch) {
    session.attempts += 1;
    await session.save();
    const remaining = OTP_MAX_ATTEMPTS - session.attempts;
    return {
      success: false,
      message: `Invalid OTP. ${remaining} attempt(s) remaining.`
    };
  }

  await OtpSession.deleteOne({ _id: session._id });
  return { success: true };
};

module.exports = {
  generateOtp,
  sendOtp,
  requestOtp,
  verifyOtp,
  requestOtpFor,
  verifyOtpFor
};
