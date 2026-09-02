const transactionService = require('../services/transactionService');
const { successResponse } = require('../utils/response');

const getTransactions = async (req, res, next) => {
  try {
    const filters = {
      type: req.query.type,
      paymentMethod: req.query.paymentMethod,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit
    };
    const data = await transactionService.getTransactions(filters);
    return successResponse(res, 'Transactions list retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTransactions
};
