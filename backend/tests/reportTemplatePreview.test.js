// Report template page: live PDF preview of unsaved report format settings.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'report-template-preview-fixture';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const LabProfile = require('../src/models/LabProfile');
const User = require('../src/models/User');
for (const name of ['Branch', 'Doctor', 'Agent']) require(`../src/models/${name}`);
const { REFERENCE_FORMAT } = require('../src/services/documentTemplateService');

let database, server, base, adminToken, staffToken;
const preview = (body, auth = adminToken) => fetch(`${base}/setup/lab-profile/document-preview`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
  body: JSON.stringify(body)
});
const unsavedFormat = (patch = {}) => ({
  documentFormats: [{ ...REFERENCE_FORMAT, ...patch }], reportFormatId: REFERENCE_FORMAT.id, billFormatId: REFERENCE_FORMAT.id, kind: 'report'
});
const pdfText = bytes => [...bytes.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)].map(match => {
  try {
    const content = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    return [...content.matchAll(/<([\da-f]+)>/gi)].map(part => Buffer.from(part[1], 'hex').toString('latin1')).join('');
  } catch { return ''; }
}).join('');
const imageCount = bytes => (bytes.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length;

before(async () => {
  database = await MongoMemoryServer.create(); await mongoose.connect(database.getUri());
  const admin = await User.create({ name: 'Template Admin', email: 'template-admin@example.test', password: 'fixture-only', role: 'Admin' });
  const staff = await User.create({ name: 'Template Staff', email: 'template-staff@example.test', password: 'fixture-only', role: 'Employee' });
  adminToken = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
  staffToken = jwt.sign({ id: String(staff._id) }, process.env.JWT_SECRET);
  await LabProfile.create({ labName: 'Template Fixture Lab' });
  const app = express(); app.use(express.json()); app.use('/setup', require('../src/routes/setupRoutes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ success: false, message: error.message }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await database?.stop(); });

test('admin gets a report PDF rendered from unsaved settings, with sample data only, and nothing is saved', async () => {
  const response = await preview({ ...unsavedFormat({ reportTitle: 'UNSAVED TEMPLATE TITLE', fontSize: 11, tableStyle: 'banded' }), letterhead: true });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/pdf/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const text = pdfText(bytes);
  assert.ok(text.includes('UNSAVED TEMPLATE TITLE'), 'the unsaved report title must be in the preview');
  assert.ok(text.includes('FORMAT PREVIEW - SAMPLE DATA'), 'the preview must be marked as sample data');
  assert.ok(text.includes('Sample Patient'), 'the preview must use the sample patient');
  const saved = await LabProfile.findOne().lean();
  assert.ok(!saved.documentFormats?.length || saved.documentFormats.every(f => f.reportTitle !== 'UNSAVED TEMPLATE TITLE'), 'preview must not save the format');
});

test('letterhead switch previews blank paper with the drawn letterhead and the pre-printed pad without it', async () => {
  const withPad = Buffer.from(await (await preview({ ...unsavedFormat(), letterhead: true })).arrayBuffer());
  const prePrinted = Buffer.from(await (await preview({ ...unsavedFormat(), letterhead: false })).arrayBuffer());
  assert.equal(prePrinted.subarray(0, 5).toString(), '%PDF-');
  assert.ok(imageCount(withPad) > imageCount(prePrinted), 'only the letterhead preview draws the header/footer art');
});

test('invalid unsaved settings are rejected with a readable 400 message', async () => {
  const response = await preview(unsavedFormat({ pageMargin: 80 }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Page margin must be between 12 and 54 pt.');
  const tooTall = await preview(unsavedFormat({ headerHeight: 400, footerHeight: 300 }));
  assert.equal(tooTall.status, 400);
  assert.match((await tooTall.json()).message, /Header and footer are too tall together/);
});

test('only an Admin can render a template preview', async () => {
  assert.equal((await preview(unsavedFormat(), staffToken)).status, 403);
  assert.equal((await preview(unsavedFormat(), null)).status, 401);
});
