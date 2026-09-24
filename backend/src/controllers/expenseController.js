const Expense = require('../models/Expense');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const { getBranchFilter, resolveBranchForCreate, assertBranchAccess } = require('../middleware/branchMiddleware');

const getExpenses = async (req, res, next) => {
  try {
    const { category, paymentMethod, startDate, endDate, month, year, search } = req.query;
    const query = { ...getBranchFilter(req) };

    if (category) query.category = category;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (search) query.$or = [{ category: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }, { name: { $regex: search, $options: 'i' } }];

    if (month || year) {
      const y = parseInt(year) || new Date().getFullYear();
      const m = month ? parseInt(month) : null;
      if (m) {
        query.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0, 23, 59, 59, 999) };
      } else {
        query.date = { $gte: new Date(y, 0, 1), $lte: new Date(y, 11, 31, 23, 59, 59, 999) };
      }
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const expenses = await Expense.find(query).populate('addedBy', 'name').sort({ date: -1 });
    return successResponse(res, 'Expenses fetched successfully', expenses);
  } catch (error) {
    next(error);
  }
};

const createExpense = async (req, res, next) => {
  try {
    const { category, amount, date, description, paymentMethod, name, spentOn, notes } = req.body;

    if (!category || amount === undefined || amount <= 0) {
      return errorResponse(res, 'Category and positive amount are required', 400);
    }

    const expense = await Expense.create({
      category,
      amount,
      branch: resolveBranchForCreate(req, req.body),
      date: date || Date.now(),
      spentOn: spentOn || date || Date.now(),
      name: name || category,
      description,
      notes: notes || '',
      addedBy: req.user?._id || null,
      paymentMethod: paymentMethod || 'Cash'
    });

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Create Expense',
      module: 'Business',
      description: `Added expense voucher for ${category} of INR ${amount}.`
    });

    return successResponse(res, 'Expense voucher recorded', expense, 201);
  } catch (error) {
    next(error);
  }
};

const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, amount, date, description, paymentMethod } = req.body;

    const expense = await Expense.findById(id);
    if (!expense) return errorResponse(res, 'Expense not found', 404);
    try { assertBranchAccess(req, expense.branch); } catch (e) { return errorResponse(res, 'Access denied for this branch', 403); }

    if (category) expense.category = category;
    if (amount !== undefined) expense.amount = amount;
    if (date) expense.date = date;
    if (description !== undefined) expense.description = description;
    if (paymentMethod) expense.paymentMethod = paymentMethod;

    await expense.save();

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Update Expense',
      module: 'Business',
      description: `Updated expense voucher for ${expense.category}.`
    });

    return successResponse(res, 'Expense voucher updated', expense);
  } catch (error) {
    next(error);
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await Expense.findById(id).select('branch category amount');
    if (!existing) return errorResponse(res, 'Expense not found', 404);
    try { assertBranchAccess(req, existing.branch); } catch (e) { return errorResponse(res, 'Access denied for this branch', 403); }
    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) return errorResponse(res, 'Expense not found', 404);

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Delete Expense',
      module: 'Business',
      description: `Deleted expense voucher for ${expense.category} of INR ${expense.amount}.`
    });

    return successResponse(res, 'Expense voucher deleted successfully');
  } catch (error) {
    next(error);
  }
};

const getExpenseSummary = async (req, res, next) => {
  try {
    const branchScope = getBranchFilter(req);
    const matchStage = Object.keys(branchScope).length ? [{ $match: branchScope }] : [];
    const totalExpenses = await Expense.aggregate([
      ...matchStage,
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const categoryWise = await Expense.aggregate([
      ...matchStage,
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]);

    // Monthly summary grouping (last 6 months)
    const monthlySummary = await Expense.aggregate([
      ...matchStage,
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    const summary = {
      total: totalExpenses[0] ? totalExpenses[0].total : 0,
      categoryWise,
      monthlySummary
    };

    return successResponse(res, 'Expense summary loaded successfully', summary);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary
};
