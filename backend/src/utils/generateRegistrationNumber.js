const Sequence = require('../models/Sequence');
const Patient = require('../models/Patient');
const Bill = require('../models/Bill');
const LabProfile = require('../models/LabProfile');

// Atomic allocation; historical date-prefixed numbers remain unchanged.
module.exports = async function generateRegistrationNumber() {
  const profile = await LabProfile.findOne().select('caseStartNumber').lean();
  const existing = await Promise.all([
    Patient.find({ registrationNumber: /^\d+$/ }).select('registrationNumber').lean(),
    Bill.find({ billNumber: /^\d+$/ }).select('billNumber').lean()
  ]);
  let floor = Math.max(0, (Number(profile?.caseStartNumber) || 1) - 1);
  for (const row of existing.flat()) floor = Math.max(floor, Number(row.registrationNumber || row.billNumber));
  try {
    await Sequence.updateOne({ _id: 'registration' }, { $max: { value: floor } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    await Sequence.updateOne({ _id: 'registration' }, { $max: { value: floor } });
  }
  const next = await Sequence.findOneAndUpdate({ _id: 'registration' }, { $inc: { value: 1 } }, { new: true });
  return String(next.value).padStart(6, '0');
};
