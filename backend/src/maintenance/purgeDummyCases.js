// One-time cleanup of the dummy cases entered before the lab went live.
// Deletes bills created before CUTOFF and everything hanging off them:
// reports, bill items, payments/refunds, USG / X-ray / imaging cases and
// report-delivery records. Patients, tests, doctors, users, expenses and
// settings are kept.
//
// Runs once per database: the first server copy to start claims a marker in
// the `maintenance` collection; every later start sees it and skips. Before
// deleting, each record is copied into a `backup_dummy_<collection>`
// collection so it can be restored. Temporary - remove once it has run.
const mongoose = require('mongoose');

const MARKER_ID = 'purge-dummy-cases-before-2026-11-19';
const CUTOFF = new Date('2026-11-19T00:00:00+05:30');

function buildPlan(billIds, reportIds, cutoff) {
  const old = { createdAt: { $lt: cutoff } };
  const byBillOrOld = { $or: [{ bill: { $in: billIds } }, old] };
  // Children first, bills last, so a half-finished run never leaves a report
  // pointing at a missing bill.
  return [
    ['deliveryattempts', { $or: [{ report: { $in: reportIds } }, { bill: { $in: billIds } }] }],
    ['reports', { _id: { $in: reportIds } }],
    ['usgcases', byBillOrOld],
    ['xraycases', byBillOrOld],
    ['modalitycases', byBillOrOld],
    ['transactions', { bill: { $in: billIds } }],
    ['billitems', { bill: { $in: billIds } }],
    ['bills', { _id: { $in: billIds } }]
  ];
}

async function purge(db, cutoff) {
  const old = { createdAt: { $lt: cutoff } };
  const billIds = (await db.collection('bills').find(old, { projection: { _id: 1 } }).toArray()).map((b) => b._id);
  const reportIds = (await db.collection('reports')
    .find({ $or: [{ bill: { $in: billIds } }, old] }, { projection: { _id: 1 } }).toArray()).map((r) => r._id);

  const deleted = {};
  for (const [name, filter] of buildPlan(billIds, reportIds, cutoff)) {
    const docs = await db.collection(name).find(filter).toArray();
    if (docs.length) {
      try {
        await db.collection(`backup_dummy_${name}`).insertMany(docs, { ordered: false });
      } catch (error) {
        // A retry after a half-finished run: records already backed up are fine.
        if (error.code !== 11000 && !(error.writeErrors || []).every((e) => e.code === 11000)) throw error;
      }
    }
    deleted[name] = (await db.collection(name).deleteMany(filter)).deletedCount;
  }
  return deleted;
}

let running = null;

// Safe to call on every request: does the work at most once per database.
function runPurgeOnce() {
  if (running) return running;
  running = (async () => {
    const db = mongoose.connection.db;
    if (!db) { running = null; return; }
    const markers = db.collection('maintenance');
    try {
      await markers.insertOne({ _id: MARKER_ID, status: 'running', cutoff: CUTOFF, startedAt: new Date() });
    } catch (error) {
      if (error.code === 11000) return; // Already done (or being done) by another server copy.
      throw error;
    }
    try {
      const deleted = await purge(db, CUTOFF);
      await markers.updateOne({ _id: MARKER_ID }, { $set: { status: 'done', deleted, finishedAt: new Date() } });
      console.log('[maintenance] dummy cases deleted:', JSON.stringify(deleted));
    } catch (error) {
      // Release the claim so the next start tries again (the work is repeatable).
      await markers.deleteOne({ _id: MARKER_ID }).catch(() => {});
      running = null;
      console.error('[maintenance] dummy case cleanup failed:', error.message);
    }
  })().catch((error) => {
    running = null;
    console.error('[maintenance] dummy case cleanup failed:', error.message);
  });
  return running;
}

// What the cleanup did, for checking from outside (counts only, no records).
async function purgeStatus() {
  const db = mongoose.connection.db;
  if (!db) return null;
  const marker = await db.collection('maintenance').findOne({ _id: MARKER_ID });
  return marker ? { status: marker.status, deleted: marker.deleted || null, finishedAt: marker.finishedAt || null } : { status: 'not run' };
}

module.exports = { runPurgeOnce, purgeStatus, purge, CUTOFF, MARKER_ID };
