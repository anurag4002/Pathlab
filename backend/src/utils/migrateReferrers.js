const ROLES = require('../constants/roles');

/**
 * Logins made by the old doctor-invite flow were given the 'Doctor' role,
 * which is also the lab's own pathologist role (staff screens). Move those
 * invite logins - a 'Doctor' user that a referral Doctor record points to
 * (Doctor.linkedUser) - to the 'Referrer' role.
 *
 * Never move anyone who has done lab work: signed, verified, rejected or
 * entered a report, or added a signature. Only lab staff can do those, so
 * such a login is the lab's pathologist even if it was once linked to a
 * referral doctor. Anyone moved earlier by mistake is moved back.
 * Safe to run on every boot.
 */
async function labWorkerIds(userIds) {
  const Report = require('../models/Report');
  const Signature = require('../models/Signature');
  if (!userIds.length) return new Set();
  const ids = userIds.map(String);
  const [signed, verified, rejected, uploaded, signatures] = await Promise.all([
    Report.distinct('signatures.signedBy', { 'signatures.signedBy': { $in: userIds } }),
    Report.distinct('verifiedBy', { verifiedBy: { $in: userIds } }),
    Report.distinct('rejectedBy', { rejectedBy: { $in: userIds } }),
    Report.distinct('uploadedBy', { uploadedBy: { $in: userIds } }),
    Signature.distinct('createdBy', { createdBy: { $in: userIds } })
  ]);
  return new Set([...signed, ...verified, ...rejected, ...uploaded, ...signatures]
    .map(String).filter((id) => ids.includes(id)));
}

async function migrateReferrerUsers() {
  const Doctor = require('../models/Doctor');
  const User = require('../models/User');

  // 1. Undo: a Referrer who has done lab work is the lab's pathologist.
  const referrers = await User.find({ role: ROLES.REFERRER }).select('_id').lean();
  const wronglyMoved = [...await labWorkerIds(referrers.map((u) => u._id))];
  let restored = 0;
  if (wronglyMoved.length) {
    const back = await User.updateMany({ _id: { $in: wronglyMoved }, role: ROLES.REFERRER }, { $set: { role: ROLES.DOCTOR } });
    restored = back.modifiedCount || 0;
    if (restored) console.log(`Restored ${restored} pathologist login(s) to the Doctor role`);
  }

  // 2. Move invite logins that have never done lab work.
  const linked = await Doctor.distinct('linkedUser', { linkedUser: { $ne: null } });
  if (!linked.length) return { moved: 0, restored };
  const candidates = await User.find({ _id: { $in: linked }, role: ROLES.DOCTOR }).select('_id').lean();
  const labWorkers = await labWorkerIds(candidates.map((u) => u._id));
  const toMove = candidates.map((u) => u._id).filter((id) => !labWorkers.has(String(id)));
  if (!toMove.length) return { moved: 0, restored };
  const result = await User.updateMany({ _id: { $in: toMove }, role: ROLES.DOCTOR }, { $set: { role: ROLES.REFERRER } });
  const moved = result.modifiedCount || 0;
  if (moved) console.log(`Moved ${moved} referring-doctor login(s) to the Referrer role`);
  return { moved, restored };
}

module.exports = { migrateReferrerUsers };
