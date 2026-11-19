// One-time cleanup of the dummy patients entered before the lab went live.
// Their bills were deleted on 19 Nov 2026, but the patients kept their
// registration numbers (1 to ~11,556), so new numbering could not start at 9.
//
// Deletes patients created before CUTOFF that have no bill left (every bill
// from before the cutoff is already gone), copying each into
// `backup_dummy_patients` first, then sets the next registration / bill
// number to NEXT_NUMBER. Runs once per database (marker in `maintenance`).
// Temporary - remove once it has run.
const mongoose = require('mongoose');

const MARKER_ID = 'purge-dummy-patients-before-2026-11-19';
const CUTOFF = new Date('2026-11-19T00:00:00+05:30');
const NEXT_NUMBER = 9;

async function purge(db) {
  const billed = await db.collection('bills').distinct('patient');
  // Patients saved by the app always have createdAt; ones without it were imported earlier.
  const filter = { $or: [{ createdAt: { $lt: CUTOFF } }, { createdAt: { $exists: false } }], _id: { $nin: billed } };
  const docs = await db.collection('patients').find(filter).toArray();
  if (docs.length) {
    try {
      await db.collection('backup_dummy_patients').insertMany(docs, { ordered: false });
    } catch (error) {
      // A retry after a half-finished run: records already backed up are fine.
      if (error.code !== 11000 && !(error.writeErrors || []).every((e) => e.code === 11000)) throw error;
    }
  }
  const patients = (await db.collection('patients').deleteMany(filter)).deletedCount;
  await db.collection('sequences').updateOne({ _id: 'registration' }, { $set: { value: NEXT_NUMBER - 1 } }, { upsert: true });
  await db.collection('labprofiles').updateMany({}, { $set: { caseStartNumber: NEXT_NUMBER } });
  return { patients, kept: await db.collection('patients').countDocuments(), nextNumber: NEXT_NUMBER };
}

let running = null;

// Safe to call on every request: does the work at most once per database.
function runPatientPurgeOnce() {
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
      const result = await purge(db);
      await markers.updateOne({ _id: MARKER_ID }, { $set: { status: 'done', result, finishedAt: new Date() } });
      console.log('[maintenance] dummy patients deleted:', JSON.stringify(result));
    } catch (error) {
      // Release the claim so the next start tries again (the work is repeatable).
      await markers.deleteOne({ _id: MARKER_ID }).catch(() => {});
      running = null;
      console.error('[maintenance] dummy patient cleanup failed:', error.message);
    }
  })().catch((error) => {
    running = null;
    console.error('[maintenance] dummy patient cleanup failed:', error.message);
  });
  return running;
}

// What the cleanup did, for checking from outside (counts only, no records).
async function patientPurgeStatus() {
  const db = mongoose.connection.db;
  if (!db) return null;
  const marker = await db.collection('maintenance').findOne({ _id: MARKER_ID });
  return marker ? { status: marker.status, result: marker.result || null, finishedAt: marker.finishedAt || null } : { status: 'not run' };
}

module.exports = { runPatientPurgeOnce, patientPurgeStatus };
