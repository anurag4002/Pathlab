process.env.NODE_ENV = 'test';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Patient = require('../src/models/Patient');
const Bill = require('../src/models/Bill');
const User = require('../src/models/User');
const Sequence = require('../src/models/Sequence');
for (const name of ['Branch', 'Doctor', 'Agent', 'BillItem', 'Transaction', 'Expense', 'Report', 'Test', 'TestCategory']) require(`../src/models/${name}`);
const { createPatient } = require('../src/services/patientService');
const billService = require('../src/services/billService');
const dashboardService = require('../src/services/dashboardService');
const { rangeStart, rangeEnd } = require('../src/utils/dateRange');

let database, user, patient;
const line = (price) => ({ itemType: 'Custom', name: `Line ${price}`, price });

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await Promise.all([Patient.init(), Bill.init(), Sequence.init()]);
  user = await User.create({ name: 'Money Admin', email: 'money@example.test', password: 'fixture-only', role: 'Admin' });
  patient = await createPatient({ name: 'Money Patient', age: 40, gender: 'Female', phone: '9876543210' });
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('a bill cannot be created with more money received than its total', async () => {
  await assert.rejects(
    billService.createBill({ patient: patient._id, items: [line(450)], paidAmount: 500, paymentMethod: 'Cash' }, user._id),
    (error) => error.statusCode === 400 && /more than the bill total/.test(error.message)
  );
  const exact = await billService.createBill({ patient: patient._id, items: [line(450)], paidAmount: 450, paymentMethod: 'Cash' }, user._id);
  assert.equal(exact.paymentStatus, 'Paid');
});

test('a payment cannot exceed the amount due', async () => {
  const bill = await billService.createBill({ patient: patient._id, items: [line(300)], paidAmount: 100, paymentMethod: 'Cash' }, user._id);
  await assert.rejects(
    billService.addPayment(bill._id, { amount: 250, paymentMethod: 'Cash' }, user._id),
    (error) => error.statusCode === 400 && /more than the amount due/.test(error.message)
  );
  const paid = await billService.addPayment(bill._id, { amount: 200, paymentMethod: 'Cash' }, user._id);
  assert.equal(Number(paid.dueAmount ?? paid.bill?.dueAmount ?? 0), 0);
});

test('outstanding bills include part-paid ones, and match the dashboard balance', async () => {
  const unpaid = await billService.createBill({ patient: patient._id, items: [line(200)], paidAmount: 0, paymentMethod: 'Cash' }, user._id);
  const partial = await billService.createBill({ patient: patient._id, items: [line(500)], paidAmount: 150, paymentMethod: 'Cash' }, user._id);
  const { bills } = await billService.getBills({ paymentStatus: 'Outstanding', limit: 50 });
  const ids = bills.map((b) => String(b._id));
  assert.ok(ids.includes(String(unpaid._id)), 'unpaid listed');
  assert.ok(ids.includes(String(partial._id)), 'part-paid listed');
  const listedDue = bills.reduce((sum, b) => sum + Number(b.dueAmount || 0), 0);
  const stats = await dashboardService.getDashboardStats(null);
  assert.equal(stats.pendingPayments, listedDue);
});

test('a date-only window covers the whole lab day (India time)', () => {
  assert.equal(rangeStart('2026-11-06').toISOString(), '2026-11-05T18:30:00.000Z');
  assert.equal(rangeEnd('2026-11-06').toISOString(), '2026-11-06T18:29:59.999Z');
  assert.equal(rangeEnd('2026-11-06T23:59:59.999').toISOString(), '2026-11-06T18:29:59.999Z');
  assert.equal(rangeEnd('', 'fallback'), 'fallback');
});
