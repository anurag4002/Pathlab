const billService = require('../services/billService');
const { successResponse, errorResponse } = require('../utils/response');
const { validateBill } = require('../validators/billValidator');
const MESSAGES = require('../constants/messages');
const Activity = require('../models/Activity');

const getBills = async (req, res, next) => {
  try {
    const filters = {
      paymentStatus: req.query.paymentStatus,
      patientId: req.query.patientId,
      search: req.query.search,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: req.query.page,
      limit: req.query.limit
    };
    const data = await billService.getBills(filters);
    return successResponse(res, 'Bills retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

const getBillById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const bill = await billService.getBillById(id);
    if (!bill) {
      return errorResponse(res, MESSAGES.BILL.NOT_FOUND, 404);
    }
    return successResponse(res, 'Bill loaded successfully', bill);
  } catch (error) {
    next(error);
  }
};

const createBill = async (req, res, next) => {
  try {
    const { errors, isValid } = validateBill(req.body);
    if (!isValid) {
      return errorResponse(res, MESSAGES.GENERAL.VALIDATION_ERROR, 400, errors);
    }

    const bill = await billService.createBill(req.body, req.user._id);

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Create Bill',
      module: 'Cases',
      description: `Generated invoice ${bill.billNumber} for amount INR ${bill.totalAmount}.`
    });

    return successResponse(res, MESSAGES.BILL.CREATED, bill, 201);
  } catch (error) {
    next(error);
  }
};

const collectPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod } = req.body;

    if (!amount || Number(amount) <= 0) {
      return errorResponse(res, 'Amount must be greater than 0', 400);
    }

    const updatedBill = await billService.addPayment(id, { amount, paymentMethod }, req.user._id);

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Collect Payment',
      module: 'Cases',
      description: `Collected payment of INR ${amount} on invoice ${updatedBill.billNumber}.`
    });

    return successResponse(res, MESSAGES.BILL.PAYMENT_ADDED, updatedBill);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBills,
  getBillById,
  createBill,
  collectPayment
};
