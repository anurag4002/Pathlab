const bcrypt = require('bcryptjs');
const OtpSession = require('../models/OtpSession');
const {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  SMS_PROVIDER,
  SMS_API_KEY,
  SMS_SENDER_ID
} = require('../config/environment');

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOtp = async (phone, otp) => {
  if (SMS_PROVIDER === 'console' || process.env.NODE_ENV === 'development') {
    console.log(`[Pure Path Lab] OTP for ${phone}: ${otp}`);
    return true;
  }

  return true;
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
  verifyOtp
};
