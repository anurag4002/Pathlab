process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'xray-pdf-fixture';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const XrayCase = require('../src/models/XrayCase');
const Patient = require('../src/models/Patient');
const User = require('../src/models/User');
const Branch = require('../src/models/Branch');
require('../src/models/Doctor'); require('../src/models/Bill');
const { getPDFDocument } = require('../src/services/pdfService');
let database, server, base, token, patient, original, replacement;

async function request(path, { method = 'GET', fields = {}, file, auth = token } = {}) {
  const headers = auth ? { Authorization: `Bearer ${auth}` } : {};
  let body;
  if (method !== 'GET') {
    body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    if (file) body.append('file', new Blob([file.bytes], { type: file.type || 'application/pdf' }), file.name || 'X-Ray.pdf');
  }
  return fetch(`${base}${path}`, { method, body, headers });
}
async function pdf(text) {
  const PDFDocument = getPDFDocument(); const doc = new PDFDocument();
  const done = new Promise(resolve => { const chunks = []; doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); });
  doc.text(text); doc.addPage().text('Original second page'); doc.end(); return done;
}
before(async () => {
  database = await MongoMemoryServer.create(); await mongoose.connect(database.getUri());
  patient = await Patient.create({ name: 'X-Ray PDF Patient', registrationNumber: '000001', age: 30, gender: 'Male', phone: '9999999999' });
  const user = await User.create({ name: 'Admin', email: 'xray@example.test', password: 'test-only', role: 'Admin' });
  token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET);
  const app = express(); app.use(express.json());
  app.use('/xray', require('../src/routes/xrayRoutes'));
  app.use('/patient', require('../src/routes/patientPortalRoutes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ success: false, message: error.message }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  original = await pdf('ORIGINAL XRAY PDF'); replacement = await pdf('REPLACED XRAY PDF');
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await database?.stop(); });

test('PDF upload completes an existing X-ray case and preserves its scan and findings', async () => {
  const record = await XrayCase.create({ patient: patient._id, status: 'Pending', findings: 'Existing findings', fileUrl: 'uploads/xray/scan.png' });
  const response = await request(`/xray/${record._id}/file`, { method: 'POST', file: { bytes: original } });
  assert.equal(response.status, 200); const { data } = await response.json();
  assert.equal(data.status, 'Completed'); assert.equal(data.reportFile.data, undefined);
  const stored = await XrayCase.findById(record._id).select('+reportFile.data');
  assert.deepEqual(Buffer.from(stored.reportFile.data), original);
  assert.equal(stored.findings, 'Existing findings'); assert.equal(stored.fileUrl, record.fileUrl);
  assert.equal((await XrayCase.findById(record._id)).reportFile.data, undefined);
  const list = await (await request('/xray')).json();
  assert.equal(list.data.find(row => row._id === String(record._id)).reportFile.data, undefined);
  for (const suffix of ['/file', '/pdf']) {
    const download = await request(`/xray/${record._id}${suffix}`);
    assert.equal(download.status, 200);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), original);
  }
  const replaced = await request(`/xray/${record._id}/file`, { method: 'POST', file: { bytes: replacement } });
  assert.equal(replaced.status, 200);
  assert.deepEqual(Buffer.from(await (await request(`/xray/${record._id}/pdf`)).arrayBuffer()), replacement);
});

test('case form accepts PDF-only creation and replacement without written findings', async () => {
  const response = await request('/xray', { method: 'POST', fields: { patient: String(patient._id), findings: '' }, file: { bytes: original } });
  assert.equal(response.status, 201); const { data } = await response.json();
  assert.equal(data.findings, ''); assert.equal(data.status, 'Completed'); assert.equal(data.reportFile.data, undefined);
  const edited = await request(`/xray/${data._id}`, { method: 'PUT', fields: { findings: '' }, file: { bytes: replacement } });
  assert.equal(edited.status, 200);
  assert.deepEqual(Buffer.from(await (await request(`/xray/${data._id}/pdf`)).arrayBuffer()), replacement);
});

test('invalid uploads and unauthorized branch access cannot replace an existing PDF', async () => {
  const branch = await Branch.create({ name: 'Other branch', code: 'OTHER' });
  const employee = await User.create({ name: 'Other staff', email: 'xraystaff@example.test', password: 'test-only', role: 'Employee', branch: branch._id });
  const auth = jwt.sign({ id: String(employee._id) }, process.env.JWT_SECRET);
  const record = await XrayCase.create({ patient: patient._id, branch: new mongoose.Types.ObjectId(), status: 'Pending' });
  assert.equal((await request(`/xray/${record._id}/file`, { method: 'POST' })).status, 400);
  assert.equal((await request(`/xray/${record._id}/file`, { method: 'POST', file: { bytes: Buffer.from('invalid') } })).status, 400);
  assert.equal((await request(`/xray/${record._id}/file`, { method: 'POST', file: { bytes: original }, auth: '' })).status, 401);
  for (const suffix of ['/file', '/pdf']) assert.equal((await request(`/xray/${record._id}${suffix}`, { auth })).status, 403);
  assert.equal((await request(`/xray/${record._id}/file`, { method: 'POST', file: { bytes: original }, auth })).status, 403);
  assert.equal((await XrayCase.findById(record._id)).status, 'Pending');
});

test('patient login can download its durable X-ray PDF but cannot download another patient report', async () => {
  const own = await XrayCase.findOne({ patient: patient._id, 'reportFile.size': { $gt: 0 } });
  const auth = jwt.sign({ phone: patient.phone, role: 'Patient', patientIds: [String(patient._id)] }, process.env.JWT_SECRET);
  const response = await request(`/patient/reports/${own._id}/download`, { auth });
  assert.equal(response.status, 200);
  const stored = await XrayCase.findById(own._id).select('+reportFile.data');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(stored.reportFile.data));
  const other = await XrayCase.create({ patient: new mongoose.Types.ObjectId(), reportFile: { data: original, size: original.length }, status: 'Completed' });
  assert.equal((await request(`/patient/reports/${other._id}/download`, { auth })).status, 404);
});

test('explicitly denied report permission also blocks PDF uploads through the case form', async () => {
  const employee = await User.create({ name: 'Restricted staff', email: 'restricted@example.test', password: 'test-only', role: 'Employee', permissions: { reports: false } });
  const auth = jwt.sign({ id: String(employee._id) }, process.env.JWT_SECRET);
  const record = await XrayCase.create({ patient: patient._id, status: 'Pending' });
  for (const [path, method] of [[`/xray/${record._id}/file`, 'POST'], [`/xray/${record._id}`, 'PUT'], ['/xray', 'POST']]) {
    assert.equal((await request(path, { method, fields: { patient: String(patient._id) }, file: { bytes: original }, auth })).status, 403);
  }
  assert.equal((await XrayCase.findById(record._id)).status, 'Pending');
});
