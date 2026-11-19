// One-time cleanup: delete the dummy cases created before a date (default:
// the start of today, India time). Removes the bills from before that date
// and everything hanging off them: reports, bill items, payments/refunds,
// USG / X-ray / imaging cases and report-delivery records. Patients, tests,
// doctors, users, expenses and settings are kept.
//
// Dry run by default: it only counts. A JSON backup of every record is
// written before anything is deleted.
//
//   MONGO_URI="mongodb+srv://..." node scripts/deleteDummyReports.js
//   MONGO_URI="mongodb+srv://..." node scripts/deleteDummyReports.js --apply
//   ... --before=2026-11-19   # delete what was created before this date (IST)
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Bill = require('../src/models/Bill');
const BillItem = require('../src/models/BillItem');
const Report = require('../src/models/Report');
const Transaction = require('../src/models/Transaction');
const USGCase = require('../src/models/USGCase');
const XrayCase = require('../src/models/XrayCase');
const ModalityCase = require('../src/models/ModalityCase');
const DeliveryAttempt = require('../src/models/DeliveryAttempt');

const { EJSON } = mongoose.mongo.BSON;

// Midnight India time (UTC+5:30) at the start of the given or current day.
function cutoffDate(arg) {
  const day = arg || new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`--before must look like 2026-11-19, got "${day}"`);
  return { day, at: new Date(`${day}T00:00:00+05:30`) };
}

(async () => {
  const apply = process.argv.includes('--apply');
  const beforeArg = (process.argv.find((a) => a.startsWith('--before=')) || '').split('=')[1];
  const { day, at } = cutoffDate(beforeArg);

  if (!process.env.MONGO_URI) {
    throw new Error('Set MONGO_URI to the database to clean (the same value the live server uses).');
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Deleting cases created before ${day} 00:00 India time (${at.toISOString()})\n`);

  const old = { createdAt: { $lt: at } };
  const billIds = (await Bill.collection.find(old, { projection: { _id: 1 } }).toArray()).map((b) => b._id);
  const byBillOrOld = { $or: [{ bill: { $in: billIds } }, old] };
  const reportIds = (await Report.collection.find(byBillOrOld, { projection: { _id: 1 } }).toArray()).map((r) => r._id);

  // Children first, bills last, so a half-finished run never leaves a report
  // pointing at a missing bill.
  const plan = [
    ['deliveryattempts', DeliveryAttempt, { $or: [{ report: { $in: reportIds } }, { bill: { $in: billIds } }] }],
    ['reports', Report, { _id: { $in: reportIds } }],
    ['usgcases', USGCase, byBillOrOld],
    ['xraycases', XrayCase, byBillOrOld],
    ['modalitycases', ModalityCase, byBillOrOld],
    ['transactions', Transaction, { bill: { $in: billIds } }],
    ['billitems', BillItem, { bill: { $in: billIds } }],
    ['bills', Bill, { _id: { $in: billIds } }]
  ];

  const counts = [];
  for (const [name, Model, filter] of plan) counts.push([name, Model, filter, await Model.collection.countDocuments(filter)]);
  for (const [name, , , n] of counts) console.log(`  ${name.padEnd(17)} ${n}`);

  const keptBills = await Bill.collection.countDocuments({ createdAt: { $gte: at } });
  const keptReports = await Report.collection.countDocuments({ _id: { $nin: reportIds } });
  console.log(`\nKept: ${keptBills} bill(s) and ${keptReports} report(s) from ${day} onwards.`);

  if (!apply) {
    console.log('\nDry run: nothing deleted. Run again with --apply to delete.');
    await mongoose.disconnect();
    return;
  }

  const backup = {};
  for (const [name, Model, filter] of counts) backup[name] = await Model.collection.find(filter).toArray();
  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `dummy-cases-before-${day}-${Date.now()}.json`);
  fs.writeFileSync(file, EJSON.stringify(backup, null, 0, { relaxed: false }));
  console.log(`\nBackup written: ${file}`);

  for (const [name, Model, filter] of counts) {
    const { deletedCount } = await Model.collection.deleteMany(filter);
    console.log(`  deleted ${String(deletedCount).padStart(6)} ${name}`);
  }
  console.log('\nDone.');
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
