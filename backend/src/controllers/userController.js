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

    const { name, email, phone, role, password, status, designation, qualification, joiningDate, departments, documents, branch } = req.body;

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
      permissions: req.body.permissions || {},
      designation: designation || '',
      qualification: qualification || '',
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      departments: Array.isArray(departments) ? departments : [],
      documents: Array.isArray(documents) ? documents : [],
      branch: branch || 'Main'
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
    if (req.body.designation !== undefined) user.designation = req.body.designation || '';
    if (req.body.qualification !== undefined) user.qualification = req.body.qualification || '';
    if (req.body.joiningDate !== undefined) user.joiningDate = req.body.joiningDate ? new Date(req.body.joiningDate) : null;
    if (req.body.departments !== undefined) user.departments = Array.isArray(req.body.departments) ? req.body.departments : [];
    if (req.body.documents !== undefined) user.documents = Array.isArray(req.body.documents) ? req.body.documents : [];
    if (req.body.branch !== undefined) user.branch = req.body.branch || 'Main';
    if (req.body.permissions && typeof req.body.permissions === 'object') {
      // Accept both Map-object and legacy array of keys (array → {key:true})
      if (Array.isArray(req.body.permissions)) {
        const m = {};
        req.body.permissions.forEach((k) => { if (typeof k === 'string') m[k] = true; });
        user.permissions = m;
      } else {
        user.permissions = req.body.permissions;
      }
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

const getUserSessions = async (req, res, next) => {
  try {
    // No session store exists yet — return empty list with documented TODO.
    // Frontend renders SessionsList empty state from this shape.
    return successResponse(res, 'Sessions (no session store yet)', { sessions: [], note: 'Session tracking not implemented server-side' });
  } catch (error) {
    next(error);
  }
};

const revokeUserSessions = async (req, res, next) => {
  try {
    await Activity.create({
      user: req.user._id,
      action: 'Revoke Sessions',
      module: 'Manage',
      description: `Requested session revoke for user ${req.params.id} (no-op: no session store).`
    });
    return successResponse(res, 'Sessions revoked (no-op: no session store)', { revoked: 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserSessions,
  revokeUserSessions
};
