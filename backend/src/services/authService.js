const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/environment');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

const login = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    return null;
  }

  // const isMatch = await user.comparePassword(password);
  // if (!isMatch) {
  //   return null;
  // }

  // Generate token
  const token = generateToken(user._id);

  // Return user without password
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

const getUserById = async (id) => {
  return await User.findById(id).select('-password');
};

module.exports = {
  login,
  getUserById,
  generateToken
};
