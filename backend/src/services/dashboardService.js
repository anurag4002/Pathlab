const Patient = require('../models/Patient');
const Bill = require('../models/Bill');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Test = require('../models/Test');
const USGCase = require('../models/USGCase');
const XrayCase = require('../models/XrayCase');
const Activity = require('../models/Activity');
const Doctor = require('../models/Doctor');

const getDashboardStats = async (branch) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const bMatch = branch ? { branch } : {};

  // Run independent reads in parallel — sequential awaits were stacking latency.
  const [
    revenueAgg,
    totalPatients,
    todayBills,
    paymentSummaryAgg,
    totalTests,
    totalBills,
    totalUSG,
    totalXray,
    recentTransactions
  ] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          type: 'Income',
          ...bMatch,
          date: { $gte: today, $lte: endOfToday }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Patient.countDocuments({ ...bMatch }),
    Bill.countDocuments({
      ...bMatch,
      date: { $gte: today, $lte: endOfToday }
    }),
    Bill.aggregate([
      { $match: { ...bMatch } },
      {
        $group: {
          _id: null,
          due: { $sum: '$dueAmount' },
          cleared: { $sum: '$paidAmount' },
          total: { $sum: '$totalAmount' }
        }
      }
    ]),
    Test.countDocuments({ status: 'Active' }),
    Bill.countDocuments({ ...bMatch }),
    USGCase.countDocuments({ ...bMatch }),
    XrayCase.countDocuments({ ...bMatch }),
    Transaction.find({ ...bMatch })
      .populate('patient', 'name registrationNumber')
      .populate('bill', 'billNumber')
      .sort({ date: -1 })
      .limit(5)
      .lean()
  ]);

  const todayRevenue = revenueAgg[0] ? revenueAgg[0].total : 0;
  const paymentSummary = paymentSummaryAgg[0] || { due: 0, cleared: 0, total: 0 };
  const pendingPayments = paymentSummary.due || 0;
  const totalCasesCount = totalBills + totalUSG + totalXray;

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

const getDailyBusiness = async (startDate, endDate, branch, options = {}) => {
  const start = new Date(startDate || new Date().setHours(0, 0, 0, 0));
  const end = new Date(endDate || new Date().setHours(23, 59, 59, 999));
  const bMatch = branch ? { branch } : {};
  const lite = Boolean(options.lite);

  // Dashboard only needs KPI totals — skip heavy populate + full transaction dump.
  if (lite) {
    const [incomeAgg, refundAgg, expenseAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...bMatch, type: 'Income', date: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { ...bMatch, type: 'Refund', date: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Expense.aggregate([
        { $match: { ...bMatch, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);
    const totalIncome = incomeAgg[0]?.total || 0;
    const totalRefunds = refundAgg[0]?.total || 0;
    const totalExpenses = expenseAgg[0]?.total || 0;
    return {
      totalIncome,
      totalExpenses,
      totalRefunds,
      netIncome: totalIncome - totalRefunds - totalExpenses,
      incomeSplit: { Cash: 0, Card: 0, UPI: 0, Insurance: 0 },
      cashierWise: [],
      caseSplit: [],
      monthlyOverview: [],
      transactions: []
    };
  }

  // Full report (Daily Business page): load range in parallel, lean docs.
  const [transactions, expenses, billDepts] = await Promise.all([
    Transaction.find({
      ...bMatch,
      date: { $gte: start, $lte: end }
    })
      .populate('patient', 'name registrationNumber')
      .populate('bill', 'billNumber referringDoctor')
      .populate('receivedBy', 'name')
      .sort({ date: -1 })
      .lean(),
    Expense.find({
      ...bMatch,
      date: { $gte: start, $lte: end }
    }).lean(),
    Bill.aggregate([
      { $match: { ...bMatch, date: { $gte: start, $lte: end }, isVoided: { $ne: true } } },
      { $group: { _id: '$department', count: { $sum: 1 }, billed: { $sum: '$totalAmount' }, collected: { $sum: '$paidAmount' }, due: { $sum: '$dueAmount' } } },
      { $sort: { billed: -1 } }
    ])
  ]);

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

  // Cashier-wise: income grouped by receivedBy (User) — replaces the mocked
  // "Add Cashier" alert with real per-clerk collections.
  const cashierWise = {};
  transactions.forEach(t => {
    if (t.type !== 'Income') return;
    const id = t.receivedBy && t.receivedBy._id ? String(t.receivedBy._id) : 'unknown';
    const name = (t.receivedBy && t.receivedBy.name) || 'Unknown';
    if (!cashierWise[id]) cashierWise[id] = { userId: id, name, income: 0, count: 0 };
    cashierWise[id].income += t.amount;
    cashierWise[id].count += 1;
  });

  const caseSplit = billDepts.map(d => ({
    department: d._id || 'LAB',
    count: d.count,
    billed: d.billed,
    collected: d.collected,
    due: d.due
  }));

  // Monthly overview (BETA): per-day income/expenses/net for the window.
  const byDay = {};
  transactions.forEach(t => {
    const k = new Date(t.date).toISOString().slice(0, 10);
    if (!byDay[k]) byDay[k] = { date: k, income: 0, refunds: 0, expenses: 0, net: 0 };
    if (t.type === 'Income') byDay[k].income += t.amount;
    if (t.type === 'Refund') byDay[k].refunds += t.amount;
  });
  expenses.forEach(e => {
    const k = new Date(e.date).toISOString().slice(0, 10);
    if (!byDay[k]) byDay[k] = { date: k, income: 0, refunds: 0, expenses: 0, net: 0 };
    byDay[k].expenses += e.amount;
  });
  Object.values(byDay).forEach(d => { d.net = d.income - d.refunds - d.expenses; });
  const monthlyOverview = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalIncome,
    totalExpenses,
    totalRefunds,
    netIncome,
    incomeSplit,
    cashierWise: Object.values(cashierWise),
    caseSplit,
    monthlyOverview,
    transactions
  };
};

const getReferralBusiness = async (startDate, endDate, branch) => {
  const query = {};
  if (branch) query.branch = branch;
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

const getMonthlyTrends = async (branch) => {
  const bMatch = branch ? { branch } : {};
  const months = [];
  const now = new Date();

  // Generate last 6 months list
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleString('default', { month: 'short' });
    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    months.push({
      month: monthName,
      year: d.getFullYear(),
      startOfMonth,
      endOfMonth
    });
  }

  const rangeStart = months[0].startOfMonth;
  const rangeEnd = months[months.length - 1].endOfMonth;

  // Two range aggregates instead of 12 per-month queries
  const [incomeByMonth, expenseByMonth] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          type: 'Income',
          ...bMatch,
          date: { $gte: rangeStart, $lte: rangeEnd }
        }
      },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' } },
          total: { $sum: '$amount' }
        }
      }
    ]),
    Expense.aggregate([
      {
        $match: {
          ...bMatch,
          date: { $gte: rangeStart, $lte: rangeEnd }
        }
      },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' } },
          total: { $sum: '$amount' }
        }
      }
    ])
  ]);

  const incomeMap = new Map(incomeByMonth.map((r) => [`${r._id.y}-${r._id.m}`, r.total]));
  const expenseMap = new Map(expenseByMonth.map((r) => [`${r._id.y}-${r._id.m}`, r.total]));

  return months.map((m) => {
    const key = `${m.startOfMonth.getFullYear()}-${m.startOfMonth.getMonth() + 1}`;
    const revenue = incomeMap.get(key) || 0;
    const expenses = expenseMap.get(key) || 0;
    return {
      month: m.month,
      year: m.year,
      revenue,
      expenses,
      net: revenue - expenses
    };
  });
};

module.exports = {
  getDashboardStats,
  getDailyBusiness,
  getReferralBusiness,
  getActivities,
  getMonthlyTrends
};
