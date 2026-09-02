const Agent = require('../models/Agent');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const getAgents = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (status) query.status = status;
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const agents = await Agent.find(query).sort({ name: 1 });
    return successResponse(res, 'Agents loaded successfully', agents);
  } catch (error) {
    next(error);
  }
};

const getAgentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agent = await Agent.findById(id);
    if (!agent) {
      return errorResponse(res, 'Agent not found', 404);
    }
    return successResponse(res, 'Agent loaded successfully', agent);
  } catch (error) {
    next(error);
  }
};

const createAgent = async (req, res, next) => {
  try {
    const { name, phone, commissionPercentage, status } = req.body;

    if (!name || !phone) {
      return errorResponse(res, 'Agent name and phone are required', 400);
    }

    const agent = await Agent.create({
      name,
      phone,
      commissionPercentage: commissionPercentage || 0,
      status: status || 'Active'
    });

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Create Agent',
      module: 'Cases',
      description: `Created agent record for ${agent.name}.`
    });

    return successResponse(res, 'Agent created successfully', agent, 201);
  } catch (error) {
    next(error);
  }
};

const updateAgent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, commissionPercentage, status } = req.body;

    const agent = await Agent.findById(id);
    if (!agent) {
      return errorResponse(res, 'Agent not found', 404);
    }

    if (name) agent.name = name;
    if (phone) agent.phone = phone;
    if (commissionPercentage !== undefined) agent.commissionPercentage = commissionPercentage;
    if (status) agent.status = status;

    await agent.save();

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Update Agent',
      module: 'Cases',
      description: `Updated agent details for ${agent.name}.`
    });

    return successResponse(res, 'Agent updated successfully', agent);
  } catch (error) {
    next(error);
  }
};

const deleteAgent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agent = await Agent.findByIdAndDelete(id);
    if (!agent) {
      return errorResponse(res, 'Agent not found', 404);
    }

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Delete Agent',
      module: 'Cases',
      description: `Removed agent record of ${agent.name}.`
    });

    return successResponse(res, 'Agent deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent
};
