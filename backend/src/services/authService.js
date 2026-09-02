const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/environment');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

const login = async (identifier, password) => {
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

  const token = generateToken(user._id);

  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status
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

  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status
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

  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status
  };

  return { user: userResponse, token };
};

const requestPasswordReset = async (identifier) => {
  const cleanIdentifier = identifier.trim();
  const user = await User.findOne({
    $or: [
      { email: cleanIdentifier.toLowerCase() },
      { phone: cleanIdentifier.replace(/\D/g, '').slice(-10) }
    ]
  });

  if (!user) {
    return { success: true, message: 'If an account exists with this identifier, recovery instructions have been initiated.' };
  }

  return {
    success: true,
    message: `Password reset request registered for ${user.name}. Please contact your laboratory Super Admin to reset your password.`
  };
};

const getUserById = async (id) => {
  return await User.findById(id).select('-password');
};

module.exports = {
  login,
  googleAuth,
  facebookAuth,
  requestPasswordReset,
  getUserById,
  generateToken
};
