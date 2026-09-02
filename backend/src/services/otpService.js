const bcrypt = require('bcryptjs');
const OtpSession = require('../models/OtpSession');
const { OTP_MAX_ATTEMPTS, SMS_PROVIDER } = require('../config/environment');

const generateNumericOTP = (length = 6) => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (mobileNumber) => {
  // 1. Generate OTP
  const otp = generateNumericOTP();
  
  // 2. Hash OTP for secure storage
  const salt = await bcrypt.genSalt(10);
  const otpHash = await bcrypt.hash(otp, salt);

  // 3. Invalidate any existing active OTP sessions for this number
  await OtpSession.deleteMany({ mobileNumber });

  // 4. Save new OTP session
  const session = new OtpSession({
    mobileNumber,
    otpHash
  });
  await session.save();

  // 5. Send OTP via SMS Provider
  if (SMS_PROVIDER === 'mock') {
    // For local development
    console.log(`\n==========================================`);
    console.log(`[MOCK SMS] OTP for ${mobileNumber} is: ${otp}`);
    console.log(`==========================================\n`);
  } else {
    // TODO: Implement actual SMS provider integration (e.g. Twilio, AWS SNS)
    // await actualSmsProvider.send(mobileNumber, `Your Pure Path Lab OTP is ${otp}`);
    console.warn(`SMS Provider ${SMS_PROVIDER} not fully implemented yet.`);
  }

  return { success: true, message: 'OTP sent successfully' };
};

const verifyOTP = async (mobileNumber, enteredOtp) => {
  const session = await OtpSession.findOne({ mobileNumber }).sort({ createdAt: -1 });

  if (!session) {
    throw new Error('OTP expired or invalid');
  }

  if (session.isVerified) {
    throw new Error('OTP already verified');
  }

  if (session.attempts >= OTP_MAX_ATTEMPTS) {
    await OtpSession.deleteOne({ _id: session._id });
    throw new Error('Maximum OTP attempts reached. Please request a new OTP.');
  }

  // Increment attempts
  session.attempts += 1;
  await session.save();

  // Verify Hash
  const isMatch = await bcrypt.compare(enteredOtp, session.otpHash);
  
  if (!isMatch) {
    throw new Error('Invalid OTP');
  }

  // Mark verified
  session.isVerified = true;
  await session.save();

  return { success: true };
};

module.exports = {
  sendOTP,
  verifyOTP
};
