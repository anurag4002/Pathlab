const Transaction = require('../models/Transaction');

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
      query.date.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  // Handle patient filters if filtering by search name
  if (filters.search) {
    // Note: To search by patient name inside a transaction list, we can perform a patient lookup first, or we can use aggregation.
    // Let's do a simple lookup first.
    const Patient = require('../models/Patient');
    const matchingPatients = await Patient.find({
      $or: [
        { name: { $regex: filters.search, $options: 'i' } },
        { registrationNumber: { $regex: filters.search, $options: 'i' } }
      ]
    }).select('_id');
    
    const patientIds = matchingPatients.map(p => p._id);
    query.$or = [
      { patient: { $in: patientIds } }
    ];
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const transactions = await Transaction.find(query)
    .populate('patient', 'name registrationNumber phone')
    .populate('bill', 'billNumber totalAmount paidAmount dueAmount')
    .populate('receivedBy', 'name')
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Transaction.countDocuments(query);

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
