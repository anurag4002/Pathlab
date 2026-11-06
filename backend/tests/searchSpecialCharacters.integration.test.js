process.env.NODE_ENV = 'test';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Patient = require('../src/models/Patient');
for (const name of ['Bill', 'Branch', 'Doctor', 'Agent', 'Report', 'Test', 'TestCategory', 'BillItem']) require(`../src/models/${name}`);
const { getAllPatients } = require('../src/services/patientService');
const { getBills } = require('../src/services/billService');
const { getReports } = require('../src/services/reportService');
const { escapeRegex } = require('../src/utils/escapeRegex');

// Text pasted into a search box (brackets, +, ?, code ...) used to reach
// MongoDB as a regular expression: "unmatched closing parenthesis" -> 500.
const NASTY = ["window.addEventListener('keydown', onKey); }, [navigate]);", 'a+b?', '(', '[x', '\\', '*', 'Mr. (Ram)'];
let database;

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await Patient.create({ name: 'Mr. (Ram) Kumar', phone: '9876500000', age: 30, gender: 'Male', registrationNumber: 'SRCH-1' });
});
after(async () => { await mongoose.disconnect(); await database.stop(); });

test('escapeRegex makes every special character literal', () => {
  for (const text of NASTY) assert.ok(new RegExp(escapeRegex(text)).test(`..${text}..`), text);
});

test('patient, bill and report searches accept any pasted text', async () => {
  for (const search of NASTY) {
    await assert.doesNotReject(getAllPatients({ search }), `patients: ${search}`);
    await assert.doesNotReject(getBills({ search }), `bills: ${search}`);
    await assert.doesNotReject(getReports({ search }), `reports: ${search}`);
  }
});

test('brackets in a name are searched literally, not as a pattern', async () => {
  const result = await getAllPatients({ search: 'Mr. (Ram)' });
  const rows = result.patients || result.data || result;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Mr. (Ram) Kumar');
});
