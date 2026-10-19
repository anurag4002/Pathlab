process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'registration-settings-fixture';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const LabProfile = require('../src/models/LabProfile');
const Sequence = require('../src/models/Sequence');
const Patient = require('../src/models/Patient');
const Bill = require('../src/models/Bill');
const User = require('../src/models/User');
for (const name of ['Branch', 'Doctor', 'Agent']) require(`../src/models/${name}`);
const { createPatient } = require('../src/services/patientService');
const { createBill } = require('../src/services/billService');
const generate = require('../src/utils/generateRegistrationNumber');
let database, server, base, admin, token, originalPatient;
async function request(method = 'GET', body, auth = token, suffix = '') {
  const headers = { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) };
  return fetch(`${base}/setup/lab-profile${suffix}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}
async function settings(body) {
  const response = await request('PUT', body);
  assert.equal(response.status, 200);
  return (await response.json()).data;
}
before(async () => {
  database = await MongoMemoryServer.create(); await mongoose.connect(database.getUri());
  await Promise.all([Patient.init(), Bill.init(), Sequence.init()]);
  admin = await User.create({ name: 'Settings Admin', email: 'numbering@example.test', password: 'fixture-only', role: 'Admin' });
  token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  const app = express(); app.use(express.json()); app.use('/setup', require('../src/routes/setupRoutes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ success: false, message: error.message }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await database?.stop(); });

test('profile displays the next available number without allocating it', async () => {
  const response = await request(); assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.registrationDigits, 6); assert.equal(data.registrationSequence.nextNumber, '000001');
  assert.equal(await Sequence.countDocuments(), 0);
});

test('saved start and digit count control both new patient registrations and their bills', async () => {
  const saved = await settings({ caseStartNumber: 100, registrationDigits: 8 });
  assert.equal(saved.registrationSequence.nextNumber, '00000100');
  assert.equal(await Sequence.countDocuments(), 0);
  originalPatient = await createPatient({ name: 'Settings Patient', age: 30, gender: 'Male', phone: '9999999999' });
  assert.equal(originalPatient.registrationNumber, '00000100');
  const bill = await createBill({ patient: originalPatient._id, items: [{ itemType: 'Custom', name: 'Fixture test', price: 100 }] }, admin._id);
  assert.equal(bill.billNumber, originalPatient.registrationNumber);
  const profile = (await (await request()).json()).data;
  assert.equal(profile.registrationSequence.nextNumber, '00000101');
});

test('changing settings preserves old numbers and cannot reset the sequence backwards', async () => {
  assert.equal((await settings({ caseStartNumber: 500, registrationDigits: 4 })).registrationSequence.nextNumber, '0500');
  assert.equal(await generate(), '0500');
  assert.equal((await settings({ caseStartNumber: 1 })).registrationSequence.nextNumber, '0501');
  assert.equal(await generate(), '0501');
  assert.equal((await Patient.findById(originalPatient._id)).registrationNumber, '00000100');
  assert.equal((await Bill.findOne({ patient: originalPatient._id })).billNumber, '00000100');
  await settings({ registrationDigits: 12 });
  const numbers = await Promise.all(Array.from({ length: 8 }, () => generate()));
  assert.equal(new Set(numbers).size, 8); assert.ok(numbers.every(number => /^\d{12}$/.test(number)));
});

test('invalid settings are rejected without changing the profile or counter', async () => {
  const oldProfile = (await LabProfile.findOne()).toObject();
  const oldCounter = (await Sequence.findById('registration')).value;
  for (const body of [
    { registrationDigits: 3 }, { registrationDigits: 13 }, { registrationDigits: 6.5 }, { registrationDigits: '' },
    { caseStartNumber: 0 }, { caseStartNumber: -1 }, { caseStartNumber: 2.5 }, { caseStartNumber: true },
    { caseStartNumber: Number.MAX_SAFE_INTEGER + 1 }
  ]) assert.equal((await request('PUT', body)).status, 400, JSON.stringify(body));
  const saved = await LabProfile.findOne();
  assert.equal(saved.caseStartNumber, oldProfile.caseStartNumber);
  assert.equal(saved.registrationDigits, oldProfile.registrationDigits);
  assert.equal((await Sequence.findById('registration')).value, oldCounter);
});

test('employees can read the sequence preview but only administrators can change it', async () => {
  const employee = await User.create({ name: 'Staff', email: 'settings-staff@example.test', password: 'fixture-only', role: 'Employee' });
  const auth = jwt.sign({ id: String(employee._id) }, process.env.JWT_SECRET);
  assert.equal((await request('GET', undefined, auth)).status, 200);
  assert.equal((await request('PUT', { registrationDigits: 4 }, auth)).status, 403);
});

test('PDF preview uses unsaved numbering settings without changing settings or allocating a number', async () => {
  const counter = (await Sequence.findById('registration')).value;
  const profile = await LabProfile.findOne();
  const response = await request('POST', { caseStartNumber: 8000, registrationDigits: 8, kind: 'bill' }, token, '/document-preview');
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const text = [...bytes.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)].map(match => {
    try {
      const content = require('node:zlib').inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      return [...content.matchAll(/<([\da-f]+)>/gi)].map(part => Buffer.from(part[1], 'hex').toString('latin1')).join('');
    } catch { return ''; }
  }).join('');
  assert.ok(text.includes('00008000'), 'PDF preview must show the unsaved digit count and start number');
  assert.equal((await Sequence.findById('registration')).value, counter);
  assert.equal((await LabProfile.findOne()).registrationDigits, profile.registrationDigits);
});
