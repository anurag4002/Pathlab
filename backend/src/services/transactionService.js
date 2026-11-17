const Transaction = require('../models/Transaction');
const { escapeRegex } = require('../utils/escapeRegex');
const { rangeStart, rangeEndOfDay } = require('../utils/dateRange');

const getTransactions = async (filters = {}) => {
  const query = {};
  if (filters.branch) query.branch = filters.branch;

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.paymentMethod) {
    query.paymentMethod = filters.paymentMethod;
  }

  if (filters.startDate || filters.endDate) {
    query.date = {};
    if (filters.startDate) {
      query.date.$gte = rangeStart(filters.startDate);
    }
    if (filters.endDate) {
      query.date.$lte = rangeEndOfDay(filters.endDate);
    }
  }

  // Handle patient filters if filtering by search name
  if (filters.search) {
    // Note: To search by patient name inside a transaction list, we can perform a patient lookup first, or we can use aggregation.
    // Let's do a simple lookup first.
    const Patient = require('../models/Patient');
    const matchingPatients = await Patient.find({
      $or: [
        { name: { $regex: escapeRegex(filters.search), $options: 'i' } },
        { registrationNumber: { $regex: escapeRegex(filters.search), $options: 'i' } }
      ]
    }).select('_id').limit(100).lean();
    
    const patientIds = matchingPatients.map(p => p._id);
    query.$or = [
      { patient: { $in: patientIds } }
    ];
  }

  const page = parseInt(filters.page) || 1;
  const limit = Math.min(parseInt(filters.limit) || 10, 100);
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate('patient', 'name registrationNumber phone')
      .populate('bill', 'billNumber totalAmount paidAmount dueAmount')
      .populate('receivedBy', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query)
  ]);

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  getTransactions
};
