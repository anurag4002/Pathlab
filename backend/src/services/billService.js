const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Transaction = require('../models/Transaction');
const generateBillNumber = require('../utils/generateBillNumber');

const createBill = async (billData, createdByUserId) => {
  const { patient, referringDoctor, agent, items, discount, paidAmount, paymentMethod } = billData;

  // Calculate totals
  let subtotal = 0;
  items.forEach(item => {
    subtotal += Number(item.price);
  });

  const discVal = Number(discount) || 0;
  const totalAmount = Math.max(0, subtotal - discVal);
  const paidVal = Number(paidAmount) || 0;
  const dueAmount = Math.max(0, totalAmount - paidVal);

  let paymentStatus = 'Pending';
  if (paidVal >= totalAmount) {
    paymentStatus = 'Paid';
  } else if (paidVal > 0) {
    paymentStatus = 'Partial';
  }

  const billNumber = await generateBillNumber();

  const bill = new Bill({
    billNumber,
    patient,
    referringDoctor: referringDoctor || null,
    agent: agent || null,
    discount: discVal,
    totalAmount,
    paidAmount: paidVal,
    dueAmount,
    paymentMethod: paymentMethod || 'Cash',
    paymentStatus,
    createdBy: createdByUserId
  });

  await bill.save();

  // Create BillItems
  const itemRecords = items.map(item => ({
    billId: bill._id,
    itemType: item.itemType,
    itemId: item.itemId,
    name: item.name,
    price: item.price
  }));

  const savedItems = await BillItem.create(itemRecords);

  // Link items to bill
  bill.items = savedItems.map(item => item._id);
  await bill.save();

  // Create transaction if paid amount is greater than 0
  if (paidVal > 0) {
    await Transaction.create({
      patient,
      bill: bill._id,
      amount: paidVal,
      paymentMethod: bill.paymentMethod,
      type: 'Income',
      receivedBy: createdByUserId
    });
  }

  return await getBillById(bill._id);
};

const getBills = async (filters = {}) => {
  const query = {};

  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }

  if (filters.patientId) {
    query.patient = filters.patientId;
  }

  if (filters.search || filters.startDate || filters.endDate) {
    // We can search by billNumber
    if (filters.search) {
      query.billNumber = { $regex: filters.search, $options: 'i' };
    }

    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) {
        query.date.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        // Set end date to end of day
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const bills = await Bill.find(query)
    .populate('patient', 'name registrationNumber phone')
    .populate('referringDoctor', 'name clinicHospital')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Bill.countDocuments(query);

  return {
    bills,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

const getBillById = async (id) => {
  return await Bill.findById(id)
    .populate('patient')
    .populate('referringDoctor')
    .populate('agent')
    .populate('items')
    .populate('createdBy', 'name');
};

const addPayment = async (billId, paymentDetails, receivedByUserId) => {
  const { amount, paymentMethod } = paymentDetails;
  const paidVal = Number(amount);

  if (isNaN(paidVal) || paidVal <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const bill = await Bill.findById(billId);
  if (!bill) {
    throw new Error('Invoice not found');
  }

  if (bill.dueAmount <= 0) {
    throw new Error('This invoice is already fully paid');
  }

  const newPaidAmount = bill.paidAmount + paidVal;
  const newDueAmount = Math.max(0, bill.totalAmount - newPaidAmount);

  bill.paidAmount = newPaidAmount;
  bill.dueAmount = newDueAmount;

  if (newPaidAmount >= bill.totalAmount) {
    bill.paymentStatus = 'Paid';
  } else {
    bill.paymentStatus = 'Partial';
  }

  if (paymentMethod) {
    bill.paymentMethod = paymentMethod;
  }

  await bill.save();

  // Create Transaction record
  await Transaction.create({
    patient: bill.patient,
    bill: bill._id,
    amount: paidVal,
    paymentMethod: bill.paymentMethod,
    type: 'Income',
    receivedBy: receivedByUserId
  });

  return await getBillById(bill._id);
};

module.exports = {
  createBill,
  getBills,
  getBillById,
  addPayment
};
