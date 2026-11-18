process.env.NODE_ENV = 'test';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { saveLabAsset, restoreLabAsset, restoreProfileAssets } = require('../src/utils/labAssetStore');
let database;
const name = `uploads/letterheads/test-asset-${Date.now()}.png`;
const file = path.join(__dirname, '../src', name);
before(async () => { database = await MongoMemoryServer.create(); await mongoose.connect(database.getUri()); });
after(async () => { fs.rmSync(file, { force: true }); await mongoose.disconnect(); await database?.stop(); });

test('an uploaded lab image survives the upload folder being wiped', async () => {
  const bytes = fs.readFileSync(path.join(__dirname, '../src/assets/document-formats/reference-signatures.png'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  await saveLabAsset(name, 'image/png');
  fs.rmSync(file); // the live server restarted: temporary folder emptied
  await restoreProfileAssets({ signatureStripUrl: name });
  assert.ok(fs.existsSync(file), 'file written back from the database');
  assert.ok(fs.readFileSync(file).equals(bytes), 'same bytes');
});

test('only lab letterhead paths are saved or restored', async () => {
  assert.equal(await restoreLabAsset('uploads/reports/secret.pdf'), false);
  assert.equal(await restoreLabAsset('uploads/letterheads/../../app.js'), false);
  assert.equal(await restoreLabAsset('uploads/letterheads/never-saved.png'), false);
});
