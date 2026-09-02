const Patient = require('../models/Patient');
const Bill = require('../models/Bill');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Test = require('../models/Test');
const USGCase = require('../models/USGCase');
const XrayCase = require('../models/XrayCase');
const Activity = require('../models/Activity');
const Doctor = require('../models/Doctor');

const getDashboardStats = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Today's Revenue (Transactions where type is Income and date is today)
  const revenueAgg = await Transaction.aggregate([
    {
      $match: {
        type: 'Income',
        date: { $gte: today, $lte: endOfToday }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);
  const todayRevenue = revenueAgg[0] ? revenueAgg[0].total : 0;

  // Total Patients
  const totalPatients = await Patient.countDocuments();

  // Today's Bills count
  const todayBills = await Bill.countDocuments({
    date: { $gte: today, $lte: endOfToday }
  });

  // Pending Payments (due amount sum on all bills)
  const pendingAgg = await Bill.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$dueAmount' }
      }
    }
  ]);
  const pendingPayments = pendingAgg[0] ? pendingAgg[0].total : 0;

  // Lab Tests count in database
  const totalTests = await Test.countDocuments({ status: 'Active' });

  // Total Cases (Bills count + USG cases + X-Ray cases)
  const totalBills = await Bill.countDocuments();
  const totalUSG = await USGCase.countDocuments();
  const totalXray = await XrayCase.countDocuments();
  const totalCasesCount = totalBills + totalUSG + totalXray;

  // Payments summary
  const paymentSummaryAgg = await Bill.aggregate([
    {
      $group: {
        _id: null,
        due: { $sum: '$dueAmount' },
        cleared: { $sum: '$paidAmount' },
        total: { $sum: '$totalAmount' }
      }
    }
  ]);
  const paymentSummary = paymentSummaryAgg[0] || { due: 0, cleared: 0, total: 0 };

  // Recent transactions
  const recentTransactions = await Transaction.find()
    .populate('patient', 'name registrationNumber')
    .sort({ date: -1 })
    .limit(5);

  return {
    todayRevenue,
    totalPatients,
    todayBills,
    pendingPayments,
    totalTests,
    totalCasesCount,
    paymentSummary,
    recentTransactions
  };
};

const getDailyBusiness = async (startDate, endDate) => {
  const start = new Date(startDate || new Date().setHours(0, 0, 0, 0));
  const end = new Date(endDate || new Date().setHours(23, 59, 59, 999));

  // Income summary for date range
  const transactions = await Transaction.find({
    date: { $gte: start, $lte: end }
  })
    .populate('patient', 'name registrationNumber')
    .populate('bill', 'billNumber referringDoctor')
    .populate('receivedBy', 'name')
    .sort({ date: -1 });

  // Expenses for date range
  const expenses = await Expense.find({
    date: { $gte: start, $lte: end }
  });

  const totalIncome = transactions
    .filter(t => t.type === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalRefunds = transactions
    .filter(t => t.type === 'Refund')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const netIncome = totalIncome - totalRefunds - totalExpenses;

  // Income split by payment method
  const incomeSplit = {
    Cash: 0,
    Card: 0,
    UPI: 0,
    Insurance: 0
  };

  transactions.forEach(t => {
    if (t.type === 'Income' && incomeSplit[t.paymentMethod] !== undefined) {
      incomeSplit[t.paymentMethod] += t.amount;
    }
  });

  return {
    totalIncome,
    totalExpenses,
    netIncome,
    incomeSplit,
    transactions
  };
};

const getReferralBusiness = async (startDate, endDate) => {
  const query = {};
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  // Get all bills with referring doctors
  const bills = await Bill.find({
    ...query,
    referringDoctor: { $ne: null }
  })
    .populate('patient', 'name registrationNumber')
    .populate('referringDoctor')
    .sort({ date: -1 });

  // Group by doctor
  const doctorCommissions = {};

  bills.forEach(bill => {
    const docId = bill.referringDoctor._id.toString();
    const docName = bill.referringDoctor.name;
    const docClinic = bill.referringDoctor.clinicHospital;
    const percentage = bill.referringDoctor.referralPercentage || 0;
    const commission = (bill.totalAmount * percentage) / 100;

    if (!doctorCommissions[docId]) {
      doctorCommissions[docId] = {
        doctorId: docId,
        doctorName: docName,
        clinicHospital: docClinic,
        commissionPercentage: percentage,
        totalBillsAmount: 0,
        totalCommission: 0,
        billsCount: 0,
        billsList: []
      };
    }

    doctorCommissions[docId].totalBillsAmount += bill.totalAmount;
    doctorCommissions[docId].totalCommission += commission;
    doctorCommissions[docId].billsCount += 1;
    doctorCommissions[docId].billsList.push({
      billNumber: bill.billNumber,
      patientName: bill.patient.name,
      registrationNumber: bill.patient.registrationNumber,
      amount: bill.totalAmount,
      commissionAmount: commission,
      date: bill.date
    });
  });

  return Object.values(doctorCommissions);
};

const getActivities = async () => {
  return await Activity.find()
    .populate('user', 'name role')
    .sort({ date: -1 })
    .limit(100);
};

module.exports = {
  getDashboardStats,
  getDailyBusiness,
  getReferralBusiness,
  getActivities
};
