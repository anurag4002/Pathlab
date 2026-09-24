const Branch = require('../models/Branch');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const getBranches = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    const branches = await Branch.find(query).sort({ name: 1 });
    return successResponse(res, 'Branches loaded', branches);
  } catch (error) {
    next(error);
  }
};

const createBranch = async (req, res, next) => {
  try {
    const { name, code, address, phone, email, status } = req.body;
    if (!name || !String(name).trim()) return errorResponse(res, 'Branch name is required', 400);
    if (!code || !String(code).trim()) return errorResponse(res, 'Branch code is required', 400);
    const exists = await Branch.findOne({
      $or: [
        { name: String(name).trim() },
        { code: String(code).trim().toUpperCase() }
      ]
    });
    if (exists) return errorResponse(res, 'Branch with same name or code already exists', 400);
    const branch = await Branch.create({
      name: String(name).trim(),
      code: String(code).trim().toUpperCase(),
      address: address || '',
      phone: phone || '',
      email: email || '',
      status: status || 'Active'
    });
    try {
      await Activity.create({
        user: req.user._id,
        action: 'Create Branch',
        module: 'Manage',
        description: `Created branch ${branch.name} (${branch.code}).`
      });
    } catch (e) { /* best-effort */ }
    return successResponse(res, 'Branch created', branch, 201);
  } catch (error) {
    if (error && error.code === 11000) return errorResponse(res, 'Branch name/code must be unique', 400);
    next(error);
  }
};

const updateBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return errorResponse(res, 'Branch not found', 404);
    const { name, code, address, phone, email, status } = req.body;
    if (name !== undefined) branch.name = String(name).trim();
    if (code !== undefined) branch.code = String(code).trim().toUpperCase();
    if (address !== undefined) branch.address = String(address);
    if (phone !== undefined) branch.phone = String(phone);
    if (email !== undefined) branch.email = String(email);
    if (status !== undefined) branch.status = status;
    await branch.save();
    return successResponse(res, 'Branch updated', branch);
  } catch (error) {
    if (error && error.code === 11000) return errorResponse(res, 'Branch name/code must be unique', 400);
    next(error);
  }
};

const deleteBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return errorResponse(res, 'Branch not found', 404);
    const inUse = await User.countDocuments({ branch: branch._id });
    if (inUse > 0) {
      return errorResponse(res, `Cannot delete: ${inUse} staff member(s) assigned to this branch. Reassign them first.`, 400);
    }
    await Branch.findByIdAndDelete(branch._id);
    return successResponse(res, 'Branch deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = { getBranches, createBranch, updateBranch, deleteBranch };
