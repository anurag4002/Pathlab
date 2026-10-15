process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'usg-report-integration';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const USGCase = require('../src/models/USGCase');
const Test = require('../src/models/Test');
const Patient = require('../src/models/Patient');
const User = require('../src/models/User');
const Bill = require('../src/models/Bill');
require('../src/models/Branch'); require('../src/models/Doctor'); require('../src/models/Agent');
const { configureUSGServices } = require('../scripts/configure-usg-services');
const { getPDFDocument } = require('../src/services/pdfService');
let database, server, base, token, patient, services, pdf;
async function request(path, { method = 'GET', body, file, auth = token } = {}) {
  const headers = auth ? { Authorization: `Bearer ${auth}` } : {};
  let data;
  if (file) { data = new FormData(); data.append('file', new Blob([file.bytes], { type: file.type || 'application/pdf' }), file.name || 'USG.pdf'); }
  else if (body) { data = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  return fetch(`${base}${path}`, { method, body: data, headers });
}
before(async () => {
  database = await MongoMemoryServer.create(); await mongoose.connect(database.getUri());
  services = await configureUSGServices(); await configureUSGServices();
  assert.equal(await Test.countDocuments(), 2, 'the catalog update is idempotent');
  const admin = await User.create({ name: 'USG Admin', email: 'usg@example.test', password: 'test-only', role: 'Admin' });
  token = jwt.sign({ id: String(admin._id), role: 'Admin' }, process.env.JWT_SECRET);
  patient = await Patient.create({ name: 'USG Patient', registrationNumber: 'USG-001', age: 33, gender: 'Female', phone: '9999999999' });
  const app = express(); app.use(express.json()); app.use('/usg', require('../src/routes/usgRoutes')); app.use('/bills', require('../src/routes/billRoutes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ success: false, message: error.message }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  const PDFDocument = getPDFDocument(); const doc = new PDFDocument();
  const done = new Promise(resolve => { const chunks = []; doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); });
  doc.text('USG ORIGINAL REPORT'); doc.addPage().text('SECOND PAGE'); doc.end(); pdf = await done;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await database?.stop(); });

test('USG bills read both rates from the database and create linked cases', async () => {
  const options = await (await request('/usg/services')).json();
  assert.deepEqual(options.data.map(option => option.price), [650, 450]);
  for (const [index, amount] of [650, 450].entries()) {
    const response = await request('/bills', { method: 'POST', body: { patient: String(patient._id), department: 'USG', items: [{ itemType: 'Test', itemId: services[index].id, name: services[index].name, price: 1 }], paidAmount: 0 } });
    assert.equal(response.status, 201); const { data: bill } = await response.json();
    assert.equal(bill.totalAmount, amount); assert.equal(bill.caseType, 'UsgCase');
    const record = await USGCase.findOne({ bill: bill._id }); assert.ok(record); assert.equal(record.price, amount);
    assert.equal(record.serviceType, index ? 'without-report' : 'with-report'); assert.equal(record.findings, '');
  }
  const prior = await Bill.findOne({ totalAmount: 650 });
  await Test.updateOne({ _id: services[0].id }, { $set: { price: 700 } });
  assert.equal((await (await request('/usg/services')).json()).data[0].price, 700);
  const response = await request('/bills', { method: 'POST', body: { patient: String(patient._id), department: 'USG', items: [{ itemType: 'Test', itemId: services[0].id, name: services[0].name, price: 650 }] } });
  assert.equal((await response.json()).data.totalAmount, 700);
  assert.equal((await Bill.findById(prior._id)).totalAmount, 650, 'historical invoice amounts are preserved');
  await Test.updateOne({ _id: services[0].id }, { $set: { price: 650 } });
});

test('USG cases accept PDF-only reports without findings, persist and print every original page', async () => {
  const created = await request('/usg', { method: 'POST', body: { patient: String(patient._id), serviceType: 'with-report' } });
  assert.equal(created.status, 201); const { data: record } = await created.json(); assert.equal(record.price, 650);
  const uploaded = await request(`/usg/${record._id}/file`, { method: 'POST', file: { bytes: pdf } });
  assert.equal(uploaded.status, 200); const saved = await uploaded.json(); assert.equal(saved.data.reportFile.data, undefined); assert.equal(saved.data.status, 'Completed');
  const fromDB = await USGCase.findById(record._id).select('+reportFile.data'); assert.deepEqual(Buffer.from(fromDB.reportFile.data), pdf);
  const reopened = await (await request(`/usg/${record._id}`)).json(); assert.equal(reopened.data.reportFile.name, 'USG.pdf'); assert.equal(reopened.data.reportFile.data, undefined);
  const listed = await (await request('/usg')).json(); assert.ok(listed.data.some(row => row._id === record._id && row.reportFile.size === pdf.length));
  for (const suffix of ['/file', '/pdf?letterhead=1']) {
    const response = await request(`/usg/${record._id}${suffix}`); assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
  }
});

test('USG rejects images, missing uploads, invalid services and unauthorized branch access', async () => {
  const created = await (await request('/usg', { method: 'POST', body: { patient: String(patient._id), serviceType: 'without-report' } })).json();
  const id = created.data._id; assert.equal(created.data.price, 450); assert.equal(created.data.status, 'Completed');
  assert.equal((await request(`/usg/${id}/file`, { method: 'POST' })).status, 400);
  assert.equal((await request(`/usg/${id}/file`, { method: 'POST', file: { bytes: Buffer.from([137,80,78,71,13,10,26,10]), name: 'scan.png', type: 'image/png' } })).status, 400);
  assert.equal((await request(`/usg/${id}/file`, { method: 'POST', file: { bytes: pdf }, auth: '' })).status, 401);
  assert.equal((await request(`/usg/${id}/pdf`)).status, 404);
  assert.equal((await request('/usg', { method: 'POST', body: { patient: String(patient._id), serviceType: 'other' } })).status, 400);
  const employee = await User.create({ name: 'Other Branch', email: 'branch@example.test', password: 'test-only', role: 'Employee', branch: new mongoose.Types.ObjectId() });
  await USGCase.updateOne({ _id: id }, { $set: { branch: new mongoose.Types.ObjectId() } });
  const auth = jwt.sign({ id: String(employee._id) }, process.env.JWT_SECRET);
  for (const suffix of ['/file', '/pdf', '']) assert.equal((await request(`/usg/${id}${suffix}`, { auth })).status, 403);
  assert.equal((await request(`/usg/${id}/file`, { method: 'POST', file: { bytes: pdf }, auth })).status, 403);
});

test('editing USG bills syncs services without duplicating cases or discarding uploaded PDFs', async () => {
  const created = await (await request('/bills', { method: 'POST', body: { patient: String(patient._id), department: 'USG', items: [{ itemType: 'Test', itemId: services[0].id, name: services[0].name, price: 650 }] } })).json();
  const bill = created.data, record = await USGCase.findOne({ bill: bill._id });
  await request(`/usg/${record._id}/file`, { method: 'POST', file: { bytes: pdf } });
  const direct = await request(`/usg/${record._id}`, { method: 'PUT', body: { serviceType: 'without-report' } }); assert.equal(direct.status, 409);
  const edited = await request(`/bills/${bill._id}`, { method: 'PUT', body: { items: [{ itemType: 'Test', itemId: services[1].id, name: services[1].name, price: 0 }] } });
  assert.equal(edited.status, 200); assert.equal((await edited.json()).data.totalAmount, 450);
  assert.equal(await USGCase.countDocuments({ bill: bill._id }), 1);
  const saved = await USGCase.findById(record._id).select('+reportFile.data'); assert.equal(saved.serviceType, 'without-report'); assert.equal(saved.price, 450); assert.deepEqual(Buffer.from(saved.reportFile.data), pdf);
  const before = await Bill.countDocuments();
  assert.equal((await request('/bills', { method: 'POST', body: { patient: String(patient._id), department: 'USG', items: [{ itemType: 'Custom', name: 'Other USG', price: 100 }] } })).status, 400);
  assert.equal(await Bill.countDocuments(), before);
});
