const ROLES = require('../constants/roles');

/**
 * Logins made by the old doctor-invite flow were given the 'Doctor' role,
 * which is also the lab's own pathologist role (staff screens). Move those
 * logins - and only those: a 'Doctor' user that a referral Doctor record
 * points to (Doctor.linkedUser) - to the 'Referrer' role.
 * Safe to run on every boot: once moved, nothing matches again.
 */
async function migrateReferrerUsers() {
  const Doctor = require('../models/Doctor');
  const User = require('../models/User');
  const linked = await Doctor.distinct('linkedUser', { linkedUser: { $ne: null } });
  if (!linked.length) return { moved: 0 };
  const result = await User.updateMany(
    { _id: { $in: linked }, role: ROLES.DOCTOR },
    { $set: { role: ROLES.REFERRER } }
  );
  const moved = result.modifiedCount || 0;
  if (moved) console.log(`Moved ${moved} referring-doctor login(s) to the Referrer role`);
  return { moved };
}

module.exports = { migrateReferrerUsers };
