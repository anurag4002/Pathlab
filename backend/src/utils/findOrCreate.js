// Atomic find-or-create for singleton settings documents ({ key: 'default' }).
// A find-then-create races when a screen asks twice at once on a fresh lab
// and the second create hits the unique index (E11000 -> 500). The upsert is
// atomic; if two upserts still collide, the other request created the
// document, so read it.
async function findOrCreate(Model, filter, defaults = {}) {
  try {
    return await Model.findOneAndUpdate(filter, { $setOnInsert: { ...filter, ...defaults } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error?.code === 11000) return Model.findOne(filter);
    throw error;
  }
}

module.exports = { findOrCreate };
