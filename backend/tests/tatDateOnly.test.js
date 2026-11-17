const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
test.before(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
test.after(async () => { await mongoose.disconnect(); await mongod.stop(); });

test('collected / received saved without a time stay date-only and are compared by day', async () => {
  const Report = require('../src/models/Report');
  const { updateTat } = require('../src/services/reportService');
  const oid = () => new mongoose.Types.ObjectId();
  const report = await Report.collection.insertOne({ status: 'Registered', uploadedBy: oid(), bill: oid(), patient: oid(), registrationNumber: 'TAT-1', tat: { registered: new Date('2026-11-17T18:16:00Z') } });
  const id = report.insertedId;
  // Collected / received: 17 Nov, time left blank (00:00 IST); reported 23:51 IST same day.
  const saved = await updateTat(id, {
    collected: '2026-11-16T18:30:00.000Z', received: '2026-11-16T18:30:00.000Z', reported: '2026-11-17T18:21:00.000Z',
    dateOnly: ['collected', 'received']
  });
  assert.deepEqual([...saved.tat.dateOnly], ['collected', 'received']);
  // Typing a time later clears the flag for that step only.
  const timed = await updateTat(id, { collected: '2026-11-17T04:30:00.000Z', dateOnly: ['received'] });
  assert.deepEqual([...timed.tat.dateOnly], ['received']);
  // Received (date only, same day) is not "earlier" than collected 10:00 that day.
  assert.equal(timed.status, 'Received');
});
