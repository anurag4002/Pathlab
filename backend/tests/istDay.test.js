// "Today" is the IST calendar day. Production runs with the server clock in
// UTC, so this file pins the process to UTC (node --test runs each file in
// its own process) and uses fixed instants, never the real time.
process.env.TZ = 'UTC';
process.env.NODE_ENV = 'test';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ist = require('../src/utils/istDay');
const { rangeStart, rangeEnd, rangeEndOfDay } = require('../src/utils/dateRange');

// 18 Nov 2026, 00:30 IST = 17 Nov 2026, 19:00 UTC.
const AFTER_MIDNIGHT = new Date('2026-11-17T19:00:00.000Z');
// 17 Nov 2026, 23:45 IST (yesterday, seen from AFTER_MIDNIGHT).
const LATE_YESTERDAY = new Date('2026-11-17T18:15:00.000Z');
// 18 Nov 2026, 10:00 IST.
const MID_MORNING = new Date('2026-11-18T04:30:00.000Z');

test('server process runs in UTC for these tests', () => {
  assert.equal(new Date('2026-11-17T19:00:00.000Z').getHours(), 19);
});

test('istDayOf gives the IST calendar day around midnight', () => {
  assert.equal(ist.istDayOf(AFTER_MIDNIGHT), '2026-11-18');
  assert.equal(ist.istDayOf(LATE_YESTERDAY), '2026-11-17');
  assert.equal(ist.istDayOf(new Date('2026-11-17T18:29:59.999Z')), '2026-11-17');
  assert.equal(ist.istDayOf(new Date('2026-11-17T18:30:00.000Z')), '2026-11-18');
  assert.equal(ist.istDayOf('2026-11-18T04:30:00.000Z'), '2026-11-18');
  assert.equal(ist.istDayOf('not a date'), '');
  assert.equal(ist.istToday(AFTER_MIDNIGHT), '2026-11-18');
  // Year / month rollover.
  assert.equal(ist.istDayOf(new Date('2026-12-31T18:30:00.000Z')), '2027-01-01');
});

test('IST day bounds and day arithmetic', () => {
  assert.equal(ist.istDayStart('2026-11-18').toISOString(), '2026-11-17T18:30:00.000Z');
  assert.equal(ist.istDayEnd('2026-11-18').toISOString(), '2026-11-18T18:29:59.999Z');
  // A Date argument means "the IST day containing that instant".
  assert.equal(ist.istDayStart(AFTER_MIDNIGHT).toISOString(), '2026-11-17T18:30:00.000Z');
  const { start, end } = ist.istDayBounds('2026-11-18');
  assert.ok(start <= AFTER_MIDNIGHT && AFTER_MIDNIGHT <= end);
  assert.ok(!(start <= LATE_YESTERDAY));
  assert.equal(ist.addIstDays('2026-11-18', -1), '2026-11-17');
  assert.equal(ist.addIstDays('2026-03-01', -1), '2026-02-28');
  assert.equal(ist.addIstDays('2026-12-31', 1), '2027-01-01');
});

test('parseIstDayParam reads YYYY-MM-DD as an IST day, rejects anything else', () => {
  const day = ist.parseIstDayParam('2026-11-18');
  assert.equal(day.start.toISOString(), '2026-11-17T18:30:00.000Z');
  assert.equal(day.end.toISOString(), '2026-11-18T18:29:59.999Z');
  assert.equal(ist.parseIstDayParam(''), null);
  assert.equal(ist.parseIstDayParam(undefined), null);
  assert.equal(ist.parseIstDayParam('2026-02-30'), null);
  assert.equal(ist.parseIstDayParam('2026-11-18T10:00'), null);
  assert.equal(ist.isIstDayString('2026-11-18'), true);
  assert.equal(ist.isIstDayString('18-11-2026'), false);
});

test('IST month bounds', () => {
  const nov = ist.istMonthBounds(2026, 11);
  assert.equal(nov.start.toISOString(), '2026-10-31T18:30:00.000Z');
  assert.equal(nov.end.toISOString(), '2026-11-30T18:29:59.999Z');
  const dec = ist.istMonthBounds(2026, 12);
  assert.equal(dec.end.toISOString(), '2026-12-31T18:29:59.999Z');
  assert.deepEqual(ist.istYearMonthOf(new Date('2026-11-30T19:00:00.000Z')), { year: 2026, month: 12 });
});

test('date range params are IST days on a UTC server', () => {
  assert.equal(rangeStart('2026-11-18').toISOString(), '2026-11-17T18:30:00.000Z');
  assert.equal(rangeEnd('2026-11-18').toISOString(), '2026-11-18T18:29:59.999Z');
  assert.equal(rangeEndOfDay('2026-11-18').toISOString(), '2026-11-18T18:29:59.999Z');
  // A timestamp end means the end of the IST day it falls in.
  assert.equal(rangeEndOfDay('2026-11-17T19:00:00.000Z').toISOString(), '2026-11-18T18:29:59.999Z');
  assert.ok(Number.isNaN(rangeEndOfDay('garbage').getTime()));
});

// ---------------------------------------------------------------------------
// Service level: a record made at 00:30 IST counts in "today".

let database, user, patient;
const Patient = require('../src/models/Patient');
const Bill = require('../src/models/Bill');
const User = require('../src/models/User');
const Sequence = require('../src/models/Sequence');
const Transaction = require('../src/models/Transaction');
const Expense = require('../src/models/Expense');
const Report = require('../src/models/Report');
const USGCase = require('../src/models/USGCase');
for (const name of ['Branch', 'Doctor', 'Agent', 'BillItem', 'Test', 'TestCategory', 'XrayCase', 'Activity']) require(`../src/models/${name}`);
const { createPatient } = require('../src/services/patientService');
const billService = require('../src/services/billService');
const reportService = require('../src/services/reportService');
const dashboardService = require('../src/services/dashboardService');
const transactionService = require('../src/services/transactionService');
const line = (price) => ({ itemType: 'Custom', name: `Line ${price}`, price });

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await Promise.all([Patient.init(), Bill.init(), Sequence.init()]);
  user = await User.create({ name: 'IST Admin', email: 'ist@example.test', password: 'fixture-only', role: 'Admin' });
  patient = await createPatient({ name: 'Midnight Patient', age: 30, gender: 'Female', phone: '9876500000' });

  // Today's bill at 00:30 IST, plus one late last night that must not count.
  const today = await billService.createBill({ patient: patient._id, items: [line(700)], paidAmount: 700, paymentMethod: 'Cash' }, user._id);
  const yesterday = await billService.createBill({ patient: patient._id, items: [line(300)], paidAmount: 300, paymentMethod: 'UPI' }, user._id);
  await Bill.updateOne({ _id: today._id }, { $set: { date: AFTER_MIDNIGHT } });
  await Bill.updateOne({ _id: yesterday._id }, { $set: { date: LATE_YESTERDAY } });
  await Transaction.updateMany({ bill: today._id }, { $set: { date: AFTER_MIDNIGHT } });
  await Transaction.updateMany({ bill: yesterday._id }, { $set: { date: LATE_YESTERDAY } });

  await Expense.collection.insertMany([
    { category: 'Misc', amount: 50, date: AFTER_MIDNIGHT, paymentMethod: 'Cash', createdBy: user._id },
    { category: 'Misc', amount: 20, date: LATE_YESTERDAY, paymentMethod: 'Cash', createdBy: user._id }
  ]);
  const oid = () => new mongoose.Types.ObjectId();
  // createBill makes reports stamped with the real time; use fixed ones only.
  await Report.deleteMany({});
  await Report.collection.insertMany([
    { status: 'Registered', uploadedBy: user._id, bill: today._id, patient: patient._id, registrationNumber: 'IST-TODAY', reportDate: AFTER_MIDNIGHT },
    { status: 'Registered', uploadedBy: user._id, bill: oid(), patient: patient._id, registrationNumber: 'IST-YDAY', reportDate: LATE_YESTERDAY }
  ]);
  await USGCase.collection.insertMany([
    { patient: patient._id, status: 'Pending', findings: 'today', date: AFTER_MIDNIGHT },
    { patient: patient._id, status: 'Pending', findings: 'yesterday', date: LATE_YESTERDAY }
  ]);
});
after(async () => { mock.timers.reset(); await mongoose.disconnect(); await database?.stop(); });

test('reports list: from=to=today (IST) includes the 00:30 IST report only', async () => {
  const res = await reportService.getReports({ from: '2026-11-18', to: '2026-11-18', limit: 100 });
  const regs = (res.reports || res.data?.reports || []).map((r) => r.registrationNumber);
  assert.deepEqual(regs, ['IST-TODAY']);
});

test('bills list: startDate=endDate=today and duration "today" include the 00:30 IST bill', async () => {
  const ranged = await billService.getBills({ startDate: '2026-11-18', endDate: '2026-11-18', limit: 50 });
  assert.deepEqual(ranged.bills.map((b) => b.totalAmount), [700]);

  // Duration presets use "now": freeze the clock at 00:30 IST.
  mock.timers.enable({ apis: ['Date'], now: AFTER_MIDNIGHT.getTime() });
  try {
    const today = await billService.getBills({ duration: 'today', limit: 50 });
    assert.deepEqual(today.bills.map((b) => b.totalAmount), [700]);
    const yesterday = await billService.getBills({ duration: 'yesterday', limit: 50 });
    assert.deepEqual(yesterday.bills.map((b) => b.totalAmount), [300]);
  } finally {
    mock.timers.reset();
  }
});

test('cashbook and transactions: one IST day window', async () => {
  const cash = await billService.getCashbook({ from: '2026-11-18', to: '2026-11-18' });
  const amounts = (cash.transactions || cash.entries || []).map((t) => t.amount);
  assert.deepEqual(amounts, [700]);
  const txns = await transactionService.getTransactions({ startDate: '2026-11-18', endDate: '2026-11-18' });
  const list = Array.isArray(txns) ? txns : (txns.transactions || []);
  assert.deepEqual(list.map((t) => t.amount), [700]);
});

test('dashboard today totals count the 00:30 IST bill and payment', async () => {
  const stats = await dashboardService.getDashboardStats(null, AFTER_MIDNIGHT);
  assert.equal(stats.todayBills, 1);
  assert.equal(stats.todayRevenue, 700);
});

test('daily business (default window = today IST) has today\'s income, expense and net', async () => {
  for (const lite of [false, true]) {
    const day = await dashboardService.getDailyBusiness(undefined, undefined, null, { now: AFTER_MIDNIGHT, lite });
    assert.equal(day.totalIncome, 700, `income lite=${lite}`);
    assert.equal(day.totalExpenses, 50, `expenses lite=${lite}`);
    assert.equal(day.netIncome, 650, `net lite=${lite}`);
  }
  // Explicit date params (what the Daily page sends) give the same answer.
  const explicit = await dashboardService.getDailyBusiness('2026-11-18', '2026-11-18T23:59:59.999', null);
  assert.equal(explicit.totalIncome, 700);
  assert.equal(explicit.totalExpenses, 50);
  // Per-day buckets are IST days.
  const twoDays = await dashboardService.getDailyBusiness('2026-11-17', '2026-11-18', null);
  assert.deepEqual(twoDays.monthlyOverview.map((d) => [d.date, d.income, d.expenses]), [
    ['2026-11-17', 300, 20],
    ['2026-11-18', 700, 50]
  ]);
});

test('USG today list (date=YYYY-MM-DD) includes the 00:30 IST case', async () => {
  const { getUSGCases } = require('../src/controllers/usgController');
  let body;
  const res = { status() { return this; }, json(payload) { body = payload; return this; } };
  await getUSGCases({ query: { date: '2026-11-18' } }, res, (error) => { throw error; });
  assert.equal(body.success, true);
  assert.deepEqual(body.data.map((c) => c.findings), ['today']);
});

test('behaviour is unchanged in the daytime (10:00 IST)', async () => {
  const stats = await dashboardService.getDashboardStats(null, MID_MORNING);
  assert.equal(stats.todayBills, 1);
  const day = await dashboardService.getDailyBusiness(undefined, undefined, null, { now: MID_MORNING });
  assert.equal(day.totalIncome, 700);
});
