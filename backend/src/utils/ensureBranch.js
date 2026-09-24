const Branch = require('../models/Branch');

/**
 * Ensure at least the Main branch exists. Returns the Main branch doc.
 * Called on server boot and from seed/migration so staff created before
 * branches existed still get a valid branch ref.
 */
async function ensureMainBranch() {
  let main = await Branch.findOne({ code: 'MAIN' });
  if (!main) {
    main = await Branch.findOne({ name: 'Main' });
  }
  if (!main) {
    main = await Branch.create({
      name: 'Main',
      code: 'MAIN',
      address: '',
      phone: '',
      status: 'Active'
    });
    console.log('Created default Main branch');
  }
  return main;
}

/**
 * Backfill branch=null transactional docs + legacy string user.branch to Main.
 * Safe to run repeatedly (only touches docs with branch == null).
 */
async function backfillBranchRefs() {
  const main = await ensureMainBranch();
  const models = [
    'Patient', 'Bill', 'Report', 'USGCase', 'XrayCase',
    'ModalityCase', 'Expense', 'Transaction', 'Inquiry'
  ];
  for (const name of models) {
    try {
      const M = require(`../models/${name}`);
      const r = await M.updateMany({ branch: null }, { $set: { branch: main._id } });
      if (r.modifiedCount > 0) console.log(`Backfilled ${r.modifiedCount} ${name} -> Main branch`);
    } catch (e) {
      console.warn(`Backfill skipped for ${name}:`, e.message);
    }
  }
  // Users with legacy string branch or null -> Main
  try {
    const User = require('../models/User');
    const users = await User.find({ $or: [{ branch: null }, { branch: { $exists: false } }] });
    for (const u of users) {
      u.branch = main._id;
      await u.save();
    }
    if (users.length) console.log(`Backfilled ${users.length} users -> Main branch`);
    // Legacy string values stored as branch (e.g. 'Main') fail ObjectId cast on read;
    // fix them with a raw collection update.
    try {
      const col = User.collection;
      const legacy = await col.updateMany(
        { branch: { $type: 'string' } },
        { $set: { branch: main._id } }
      );
      if (legacy.modifiedCount > 0) console.log(`Fixed ${legacy.modifiedCount} legacy string user.branch -> Main`);
    } catch (e) { /* ignore */ }
  } catch (e) {
    console.warn('User backfill skipped:', e.message);
  }
  return main;
}

module.exports = { ensureMainBranch, backfillBranchRefs };
