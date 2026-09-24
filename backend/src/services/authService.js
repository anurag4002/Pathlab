const jwt = require('jsonwebtoken');
const User = require('../models/User');
const WebBrowser = require('../models/WebBrowser');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/environment');
const { requestOtpFor, verifyOtpFor } = require('./otpService');

// remember=true -> 30d token, else JWT_EXPIRES_IN (default 7d).
const generateToken = (userId, remember = false) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: remember ? '30d' : (JWT_EXPIRES_IN || '7d') });
};

// Browser allow-list enforcement: once the lab registers browsers, logins
// must carry an approved browserCode. Zero configured browsers => allow all
// (bootstrap mode) so the first admin is never locked out.
const checkBrowserAllowed = async (browserCode) => {
  const active = await WebBrowser.countDocuments({ status: 'Active' });
  if (active === 0) return { allowed: true, bootstrap: true };
  if (!browserCode) return { allowed: false, reason: 'This browser is not registered. Contact your administrator for the browser code.' };
  const found = await WebBrowser.findOne({ code: String(browserCode).trim(), status: 'Active' });
  if (!found) return { allowed: false, reason: 'This browser is not approved for staff login.' };
  found.lastSeenAt = new Date();
  await found.save();
  return { allowed: true, browser: found };
};

const login = async (identifier, password, remember = false) => {
  const cleanIdentifier = identifier.trim();
  const user = await User.findOne({
    $or: [
      { email: cleanIdentifier.toLowerCase() },
      { phone: cleanIdentifier.replace(/\D/g, '').slice(-10) }
    ]
  });

  if (!user) {
    return null;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return null;
  }

  if (user.status === 'Inactive') {
    throw new Error('User account is inactive. Please contact your administrator.');
  }

  const token = generateToken(user._id, remember);

  await user.populate('branch', 'name code status');
  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    branch: user.branch || null,
    permissions: user.permissions || {}
  };

  return { user: userResponse, token };
};

const googleAuth = async ({ email, name, googleId }) => {
  if (!email) {
    throw new Error('Google authentication requires an associated email address.');
  }

  let user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // If not found, create new staff/admin user with Doctor/Staff baseline role
    user = await User.create({
      name: name || 'Google User',
      email: email.toLowerCase(),
      phone: '0000000000',
      role: 'Employee',
      password: `oauth_${Math.random().toString(36).slice(-8)}`,
      status: 'Active'
    });
  }

  if (user.status === 'Inactive') {
    throw new Error('User account is inactive. Please contact your administrator.');
  }

  const token = generateToken(user._id);
  await user.populate('branch', 'name code status');

  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    branch: user.branch || null
  };

  return { user: userResponse, token };
};

const facebookAuth = async ({ email, name, facebookId }) => {
  const lookupEmail = email ? email.toLowerCase() : `fb_${facebookId}@purepathlab.com`;
  let user = await User.findOne({ email: lookupEmail });

  if (!user) {
    user = await User.create({
      name: name || 'Facebook User',
      email: lookupEmail,
      phone: '0000000000',
      role: 'Employee',
      password: `oauth_${Math.random().toString(36).slice(-8)}`,
      status: 'Active'
    });
  }

  if (user.status === 'Inactive') {
    throw new Error('User account is inactive. Please contact your administrator.');
  }

  const token = generateToken(user._id);
  await user.populate('branch', 'name code status');

  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    branch: user.branch || null
  };

  return { user: userResponse, token };
};

// Real forgot-password: OTP to the staff member's registered phone (sms)
// or email, then reset with the code. Unknown identifiers still return
// success to prevent user enumeration.
const requestPasswordReset = async (identifier) => {
  const cleanIdentifier = String(identifier || '').trim();
  const user = await User.findOne({
    $or: [
      { email: cleanIdentifier.toLowerCase() },
      { phone: cleanIdentifier.replace(/\D/g, '').slice(-10) }
    ]
  });

  if (!user) {
    return { success: true, message: 'If an account exists with this identifier, recovery instructions have been initiated.' };
  }

  const useEmail = cleanIdentifier.includes('@');
  await requestOtpFor({
    phone: useEmail ? '' : user.phone,
    email: useEmail ? user.email : '',
    channel: useEmail ? 'email' : 'sms',
    purpose: 'forgot-password'
  });
  return { success: true, message: `OTP sent to your registered ${useEmail ? 'email' : 'phone'}.`, channel: useEmail ? 'email' : 'sms' };
};

const resetPasswordWithOtp = async (identifier, otp, newPassword) => {
  if (!newPassword || String(newPassword).length < 6) {
    throw Object.assign(new Error('New password must be at least 6 characters'), { statusCode: 400 });
  }
  const cleanIdentifier = String(identifier || '').trim();
  const useEmail = cleanIdentifier.includes('@');
  const user = await User.findOne({
    $or: [
      { email: cleanIdentifier.toLowerCase() },
      { phone: cleanIdentifier.replace(/\D/g, '').slice(-10) }
    ]
  });
  if (!user) {
    throw Object.assign(new Error('Invalid reset request'), { statusCode: 400 });
  }
  const check = await verifyOtpFor({
    phone: useEmail ? '' : user.phone,
    email: useEmail ? user.email : '',
    inputOtp: otp,
    purpose: 'forgot-password'
  });
  if (!check.success) {
    throw Object.assign(new Error(check.message), { statusCode: 400 });
  }
  user.password = newPassword;
  await user.save();
  return { success: true, message: 'Password reset successfully. Please login.' };
};

// Email OTP staff login: request a code, verify it, get the same JWT.
const requestEmailOtp = async (email) => {
  const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });
  if (!user) {
    return { success: true, message: 'If an account exists with this email, an OTP has been sent.' };
  }
  if (user.status === 'Inactive') throw new Error('User account is inactive. Please contact your administrator.');
  await requestOtpFor({ email: user.email, channel: 'email', purpose: 'staff-login' });
  return { success: true, message: 'OTP sent to your email.' };
};

const verifyEmailOtp = async (email, otp, remember = false) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const user = await User.findOne({ email: cleanEmail });
  if (!user) throw Object.assign(new Error('Invalid login request'), { statusCode: 400 });
  if (user.status === 'Inactive') throw new Error('User account is inactive. Please contact your administrator.');
  const check = await verifyOtpFor({ email: cleanEmail, inputOtp: otp, purpose: 'staff-login' });
  if (!check.success) throw Object.assign(new Error(check.message), { statusCode: 400 });
  const token = generateToken(user._id, remember);
  await user.populate('branch', 'name code status');
  return {
    user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status, branch: user.branch || null, permissions: user.permissions || {} },
    token
  };
};

const getUserById = async (id) => {
  return await User.findById(id).select('-password').populate('branch', 'name code status');
};

module.exports = {
  login,
  googleAuth,
  facebookAuth,
  requestPasswordReset,
  resetPasswordWithOtp,
  requestEmailOtp,
  verifyEmailOtp,
  checkBrowserAllowed,
  getUserById,
  generateToken
};
