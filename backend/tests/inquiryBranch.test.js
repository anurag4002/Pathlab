const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
test.before(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
test.after(async () => { await mongoose.disconnect(); await mongod.stop(); });

const call = (fn, req) => new Promise((resolve, reject) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(body) { resolve({ statusCode: this.statusCode, body }); return this; } };
  Promise.resolve(fn(req, res, reject)).catch(reject);
});

test('employees see online bookings without a branch; handling one gives it their branch', async () => {
  require('../src/models/Patient');
  const Inquiry = require('../src/models/Inquiry');
  const { listInquiries, setInquiryStatus } = require('../src/controllers/inquiryController');
  const mine = new mongoose.Types.ObjectId();
  const other = new mongoose.Types.ObjectId();
  const item = [{ kind: 'Test', name: 'CBC', price: 100 }];
  const online = await Inquiry.create({ name: 'Online Booking', phone: '9000000011', items: item, branch: null });
  await Inquiry.create({ name: 'My Branch Booking', phone: '9000000012', items: item, branch: mine });
  await Inquiry.create({ name: 'Other Branch Booking', phone: '9000000013', items: item, branch: other });
  const employee = { _id: new mongoose.Types.ObjectId(), role: 'Employee', branch: mine };
  const list = await call(listInquiries, { user: employee, query: {} });
  const names = list.body.data.inquiries.map((i) => i.name).sort();
  assert.deepEqual(names, ['My Branch Booking', 'Online Booking']);
  const searched = await call(listInquiries, { user: employee, query: { search: 'Booking' } });
  assert.equal(searched.body.data.inquiries.length, 2, 'search keeps the branch rule');
  await call(setInquiryStatus, { user: employee, params: { id: String(online._id) }, body: { status: 'Confirmed' } });
  assert.equal(String((await Inquiry.findById(online._id)).branch), String(mine));
  const admin = await call(listInquiries, { user: { role: 'Admin' }, query: {} });
  assert.equal(admin.body.data.inquiries.length, 3);
});
