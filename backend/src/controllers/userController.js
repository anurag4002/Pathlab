const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');
const { validateUserCreate } = require('../validators/authValidator');
const Activity = require('../models/Activity');

const getUsers = async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    const query = {};

    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    return successResponse(res, 'Users fetched successfully', users);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { errors, isValid } = validateUserCreate(req.body);
    if (!isValid) {
      return errorResponse(res, 'Validation failed', 400, errors);
    }

    const { name, email, phone, role, password, status } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 'A user with this email already exists', 400);
    }

    const newUser = await User.create({
      name,
      email,
      phone,
      role,
      password,
      status: status || 'Active',
      permissions: req.body.permissions || {}
    });

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Create User',
      module: 'Manage',
      description: `Created user account for ${name} (${role}).`
    });

    const userResponse = await User.findById(newUser._id).select('-password');
    return successResponse(res, 'User created successfully', userResponse, 201);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, password, status } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return errorResponse(res, 'A user with this email already exists', 400);
      }
      user.email = email;
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (status) user.status = status;
    if (req.body.permissions && typeof req.body.permissions === 'object') {
      user.permissions = req.body.permissions;
    }
    if (password && password.trim() !== '') {
      user.password = password; // pre-save hook will hash it
    }

    await user.save();

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Update User',
      module: 'Manage',
      description: `Updated user account details for ${user.name}.`
    });

    const userResponse = await User.findById(user._id).select('-password');
    return successResponse(res, 'User updated successfully', userResponse);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent deleting oneself
    if (id === req.user._id.toString()) {
      return errorResponse(res, 'You cannot delete your own account', 400);
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Delete User',
      module: 'Manage',
      description: `Deleted user account for ${user.name} (${user.role}).`
    });

    return successResponse(res, 'User deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
