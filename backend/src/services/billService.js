const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Transaction = require('../models/Transaction');
const generateBillNumber = require('../utils/generateBillNumber');

const CASE_TYPES = ['LabCase', 'UsgCase', 'DigitalXrayCase', 'XrayCase', 'OutsourceLabCase', 'EcgCase', 'CtScanCase', 'MriCase', 'EpsCase', 'OpgCase', 'CardiologyCase', 'EegCase', 'MammographyCase'];

const durationToDates = (duration) => {
  const now = new Date();
  const end = new Date(); end.setHours(23, 59, 59, 999);
  let start = null;
  const d = String(duration || '').toLowerCase();
  if (d.includes('7') || d === 'past 7 days' || d === 'last 7') { start = new Date(); start.setDate(now.getDate() - 6); }
  else if (d.includes('30') || d === 'past 30 days') { start = new Date(); start.setDate(now.getDate() - 29); }
  else if (d.includes('90')) { start = new Date(); start.setDate(now.getDate() - 89); }
  else if (d === 'today') { start = new Date(); }
  else if (d === 'yesterday') { start = new Date(); start.setDate(now.getDate() - 1); end.setDate(now.getDate() - 1); }
  if (start) start.setHours(0, 0, 0, 0);
  return { start, end };
};

const createBill = async (billData, createdByUserId) => {
  const { patient, referringDoctor, agent, items, discount, paidAmount, paymentMethod, department, collectionCentre, caseType, uhid, dailyCaseNo, onlineReportRequested, discountPercent, branch } = billData;

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

  const Patient = require('./patientService');
  let denormUhid = uhid || '';
  let denormDcn = dailyCaseNo || '';
  try {
    const PatientModel = require('../models/Patient');
    const p = await PatientModel.findById(patient).select('uhid registrationNumber');
    if (p) { if (!denormUhid && p.uhid) denormUhid = p.uhid; if (!denormDcn && p.registrationNumber) denormDcn = p.registrationNumber; }
  } catch (e) { /* non-fatal */ }

  const Branch = require('../models/Branch');
  let branchId = branch || null;
  if (branchId) {
    try {
      const b = await Branch.findById(branchId).select('name');
      if (b && !collectionCentre) billData._branchName = b.name;
    } catch (e) { /* ignore */ }
  }
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
    department: (department || 'LAB').toUpperCase(),
    branch: branchId,
    collectionCentre: collectionCentre || billData._branchName || 'Main',
    caseType: CASE_TYPES.includes(caseType) ? caseType : 'LabCase',
    uhid: denormUhid || '',
    dailyCaseNo: denormDcn || '',
    onlineReportRequested: !!onlineReportRequested,
    discountPercent: !!discountPercent,
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
      branch: branchId,
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
  const PatientModel = require('../models/Patient');
  if (filters.branch) query.branch = filters.branch;

  if (!filters.includeVoided && filters.cancelled !== 'true' && filters.cancelled !== true) {
    // Exclude voided by default; explicit cancelled=true shows cancelled/voided
    if (!filters.excludeCancelled || filters.excludeCancelled === 'false') {
      // keep default: hide voided
    }
    query.isVoided = { $ne: true };
  }
  // Labsmart §5: exclude-cancelled checkbox
  if (filters.excludeCancelled === 'true' || filters.excludeCancelled === true) {
    query.isVoided = { $ne: true };
    query.cancelled = { $ne: true };
  }
  if (filters.cancelled === 'true' || filters.cancelled === true) {
    query.$or = [{ cancelled: true }, { isVoided: true }];
    delete query.isVoided;
  }

  if (filters.department) {
    query.department = String(filters.department).toUpperCase();
  }
  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }
  if (filters.patientId) query.patient = filters.patientId;
  if (filters.referredBy || filters.referrer) {
    query.referringDoctor = filters.referredBy || filters.referrer;
  }
  if (filters.collectionCentre || filters.centre) {
    query.collectionCentre = filters.collectionCentre || filters.centre;
  }
  if (filters.agent || filters.sampleCollector) {
    query.agent = filters.agent || filters.sampleCollector;
  }
  if (filters.caseType) {
    const types = String(filters.caseType).split(',').map((s) => s.trim()).filter(Boolean);
    query.caseType = types.length > 1 ? { $in: types } : types[0];
  }
  if (filters.hasDue === 'true' || filters.hasDue === true) {
    query.dueAmount = { $gt: 0 };
  }
  if (filters.uhid) query.uhid = { $regex: String(filters.uhid), $options: 'i' };
  if (filters.dailyCaseNo) query.dailyCaseNo = { $regex: String(filters.dailyCaseNo), $options: 'i' };
  if (filters.regNo || filters.regno || filters.registrationNumber) {
    const v = filters.regNo || filters.regno || filters.registrationNumber;
    // Match denormalised DCN + bill number; patient reg lookup below also covers it
    query.$and = query.$and || [];
    query.$and.push({ $or: [{ dailyCaseNo: { $regex: v, $options: 'i' } }, { billNumber: { $regex: v, $options: 'i' } }] });
  }

  // Duration presets: Past 7/30/90 days, Today, Yesterday (§9)
  if (filters.duration && !filters.startDate && !filters.endDate) {
    const { start, end } = durationToDates(filters.duration);
    if (start) { query.date = { $gte: start, $lte: end }; }
  }
  if (filters.startDate || filters.endDate) {
    query.date = query.date || {};
    if (filters.startDate) query.date.$gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  // Patient-scoped text: firstName / patient name / phone search
  const patientText = filters.firstName || filters.patientName || null;
  if (patientText) {
    const matched = await PatientModel.find({ name: { $regex: String(patientText), $options: 'i' } }).select('_id');
    const ids = matched.map((m) => m._id);
    query.patient = query.patient ? query.patient : { $in: ids.length ? ids : [] };
  }

  if (filters.search) {
    const s = String(filters.search);
    // Search across billNumber + denormalised fields; patient name/phone via lookup
    const matched = await PatientModel.find({
      $or: [
        { name: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { registrationNumber: { $regex: s, $options: 'i' } },
        { uhid: { $regex: s, $options: 'i' } }
      ]
    }).select('_id');
    const ids = matched.map((m) => m._id);
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { billNumber: { $regex: s, $options: 'i' } },
        { uhid: { $regex: s, $options: 'i' } },
        { dailyCaseNo: { $regex: s, $options: 'i' } },
        ...(ids.length ? [{ patient: { $in: ids } }] : [])
      ]
    });
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const bills = await Bill.find(query)
    .populate('patient', 'name registrationNumber phone uhid age gender')
    .populate('referringDoctor', 'name clinicHospital contact')
    .populate('agent', 'name phone')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Bill.countDocuments(query);

  return {
    bills,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    meta: { caseTypes: CASE_TYPES }
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
    branch: bill.branch || null,
    amount: paidVal,
    paymentMethod: bill.paymentMethod,
    type: 'Income',
    receivedBy: receivedByUserId
  });

  return await getBillById(bill._id);
};

// Cashbook: transactions in a date window + summary {in,out,net,byMode}.
// type filter: 'in' -> Income, 'out' -> Expense+Refund (also accepts raw
// Income/Refund/Expense). mode filter maps to paymentMethod.
const getCashbook = async (filters = {}) => {
  const { from, to, mode, type, branch } = filters;
  if (from && to && new Date(from) > new Date(to)) {
    const err = new Error('Invalid date range: from is after to');
    err.statusCode = 400;
    throw err;
  }
  const query = {};
  if (branch) query.branch = branch;
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }
  if (mode) query.paymentMethod = mode;
  if (type) {
    if (type === 'in') query.type = 'Income';
    else if (type === 'out') query.type = { $in: ['Expense', 'Refund'] };
    else query.type = type;
  }
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(filters.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const [transactions, total, sums] = await Promise.all([
    Transaction.find(query)
      .populate('patient', 'name registrationNumber phone')
      .populate('bill', 'billNumber totalAmount paidAmount dueAmount')
      .populate('receivedBy', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments(query),
    Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: { type: '$type', mode: '$paymentMethod' },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  let inward = 0;
  let outward = 0;
  const byMode = {};
  sums.forEach((s) => {
    const t = s._id && s._id.type;
    const m = (s._id && s._id.mode) || 'Unknown';
    byMode[m] = byMode[m] || { in: 0, out: 0, count: 0 };
    byMode[m].count += s.count;
    if (t === 'Income') { inward += s.total; byMode[m].in += s.total; }
    else { outward += s.total; byMode[m].out += s.total; }
  });

  return {
    transactions,
    summary: { in: inward, out: outward, net: inward - outward, byMode },
    pagination: { total, page, limit, pages: Math.ceil(total / limit) }
  };
};

// Manual cash in/out with no bill link (Admin/finance). type 'in'|'out'
// maps to Income|Expense; mode maps to paymentMethod.
const createManualCashEntry = async ({ amount, type, mode, note, date, branch }, userId) => {
  const val = Number(amount);
  if (isNaN(val) || val <= 0) {
    const err = new Error('Amount must be greater than 0');
    err.statusCode = 400;
    throw err;
  }
  if (!['in', 'out'].includes(type)) {
    const err = new Error("type must be 'in' or 'out'");
    err.statusCode = 400;
    throw err;
  }
  const METHODS = ['Cash', 'Card', 'UPI', 'Insurance'];
  if (!METHODS.includes(mode)) {
    const err = new Error('Invalid mode. Use Cash|Card|UPI|Insurance');
    err.statusCode = 400;
    throw err;
  }
  const txn = await Transaction.create({
    patient: null,
    bill: null,
    branch: branch || null,
    amount: val,
    paymentMethod: mode,
    type: type === 'in' ? 'Income' : 'Expense',
    receivedBy: userId,
    ...(date ? { date: new Date(date) } : {})
  });
  // Keep the operator note in the audit trail (Transaction has no note field).
  try {
    const Activity = require('../models/Activity');
    await Activity.create({
      user: userId,
      action: 'Manual Cash Entry',
      module: 'Cases',
      description: `Manual cash ${type} of INR ${val} via ${mode}.${note ? ` Note: ${note}` : ''}`
    });
  } catch (e) { /* audit best-effort */ }
  return txn;
};

// Refund: validate amount>0 && <=paidAmount, create Refund transaction,
// decrement paid / increment due, recompute status.
const refundBill = async (billId, { amount, method, reason }, userId) => {
  const refundVal = Number(amount);
  if (isNaN(refundVal) || refundVal <= 0) {
    const err = new Error('Refund amount must be greater than 0');
    err.statusCode = 400;
    throw err;
  }
  const METHODS = ['Cash', 'Card', 'UPI', 'Insurance'];
  const payMethod = method || 'Cash';
  if (!METHODS.includes(payMethod)) {
    const err = new Error('Invalid refund method. Use Cash|Card|UPI|Insurance');
    err.statusCode = 400;
    throw err;
  }
  const bill = await Bill.findById(billId);
  if (!bill) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    throw err;
  }
  if (bill.isVoided) {
    const err = new Error('Cannot refund a voided bill');
    err.statusCode = 400;
    throw err;
  }
  if (refundVal > bill.paidAmount) {
    const err = new Error('Refund amount cannot exceed paid amount');
    err.statusCode = 400;
    throw err;
  }
  bill.paidAmount = Math.max(0, bill.paidAmount - refundVal);
  bill.dueAmount = Math.max(0, bill.totalAmount - bill.paidAmount);
  bill.paymentStatus = bill.paidAmount >= bill.totalAmount && bill.totalAmount > 0
    ? 'Paid'
    : bill.paidAmount > 0 ? 'Partial' : 'Pending';
  await bill.save();
  await Transaction.create({
    patient: bill.patient,
    bill: bill._id,
    branch: bill.branch || null,
    amount: refundVal,
    paymentMethod: payMethod,
    type: 'Refund',
    receivedBy: userId
  });
  try {
    const Activity = require('../models/Activity');
    await Activity.create({
      user: userId,
      action: 'Refund Bill',
      module: 'Cases',
      description: `Refunded INR ${refundVal} via ${payMethod} on invoice ${bill.billNumber}. Reason: ${reason || 'not specified'}.`
    });
  } catch (e) { /* audit best-effort */ }
  return await getBillById(bill._id);
};

// Edit: only unpaid/partial bills. Allows discount/paymentMethod/
// collectionCentre/caseType; recalcs totals from items. Fully Paid or voided
// bills are rejected unless adminOverride===true by an Admin.
const updateBill = async (billId, updates = {}, user = null) => {
  const bill = await Bill.findById(billId).populate('items');
  if (!bill) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    throw err;
  }
  const locked = bill.paymentStatus === 'Paid' || bill.isVoided || bill.cancelled;
  const override = updates.adminOverride === true && user && user.role === 'Admin';
  if (locked && !override) {
    const err = new Error('Bill is locked (Paid/voided). Admin override required.');
    err.statusCode = 409;
    throw err;
  }
  const ALLOWED = ['discount', 'paymentMethod', 'collectionCentre', 'caseType', 'centre', 'paidMethod'];
  const hasAllowed = ALLOWED.some((k) => updates[k] !== undefined);
  if (!hasAllowed) {
    const err = new Error('No editable fields provided (discount/paymentMethod/collectionCentre/caseType)');
    err.statusCode = 400;
    throw err;
  }
  if (updates.discount !== undefined) {
    const d = Number(updates.discount);
    if (isNaN(d) || d < 0) {
      const err = new Error('Discount must be >= 0');
      err.statusCode = 400;
      throw err;
    }
    bill.discount = d;
  }
  const method = updates.paymentMethod || updates.paidMethod;
  if (method !== undefined) {
    if (!['Cash', 'Card', 'UPI', 'Insurance'].includes(method)) {
      const err = new Error('Invalid payment method');
      err.statusCode = 400;
      throw err;
    }
    bill.paymentMethod = method;
  }
  const centre = updates.collectionCentre || updates.centre;
  if (centre !== undefined) bill.collectionCentre = String(centre);
  if (updates.caseType !== undefined) {
    if (!CASE_TYPES.includes(updates.caseType)) {
      const err = new Error('Invalid caseType');
      err.statusCode = 400;
      throw err;
    }
    bill.caseType = updates.caseType;
  }
  // Recalc totals from item prices minus discount.
  const subtotal = (bill.items || []).reduce((s, it) => s + Number(it.price || 0), 0);
  bill.totalAmount = Math.max(0, subtotal - Number(bill.discount || 0));
  bill.dueAmount = Math.max(0, bill.totalAmount - bill.paidAmount);
  bill.paymentStatus = bill.paidAmount >= bill.totalAmount && bill.totalAmount > 0
    ? 'Paid'
    : bill.paidAmount > 0 ? 'Partial' : 'Pending';
  await bill.save();
  try {
    const Activity = require('../models/Activity');
    await Activity.create({
      user: user ? user._id : null,
      action: 'Edit Bill',
      module: 'Cases',
      description: `Edited invoice ${bill.billNumber} (discount/method/centre/caseType).`
    });
  } catch (e) { /* audit best-effort */ }
  return await getBillById(bill._id);
};

// Fraud guard: void instead of hard delete. Voided bills stay in history
// (excluded from lists by default) and keep their transactions untouched.
const voidBill = async (billId, reason, userId) => {
  const bill = await Bill.findById(billId);
  if (!bill) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    throw err;
  }
  if (bill.isVoided) return bill;
  if (bill.paidAmount > 0) {
    const err = new Error('Cannot void a bill with collected payments. Issue a refund instead.');
    err.statusCode = 400;
    throw err;
  }
  bill.isVoided = true;
  bill.voidReason = reason || '';
  await bill.save();
  return bill;
};

const ensureBillQrToken = async (bill) => {
  if (bill.qrToken) return bill.qrToken;
  const { newPublicToken } = require('./qrService');
  const { JWT_SECRET } = require('../config/environment');
  bill.qrToken = newPublicToken(JWT_SECRET);
  await bill.save();
  return bill.qrToken;
};

module.exports = {
  createBill,
  getBills,
  getBillById,
  addPayment,
  voidBill,
  refundBill,
  updateBill,
  getCashbook,
  createManualCashEntry,
  ensureBillQrToken
};
