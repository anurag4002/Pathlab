const mongoose = require('mongoose');

const TestPanelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  tests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  }],
  price: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  // Department the panel prints under and its position in the panel list
  // (Labsmart files e.g. Torch Profile under Biochemistry, not by its tests).
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestCategory',
    default: null
  },
  displayOrder: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// A panel lists each test once. Imported panels repeated tests whose names
// contain a comma ("Hematocrit Value, Hct"); keep the first position.
const uniqueIds = (list = []) => {
  const seen = new Set();
  return list.filter((id) => {
    const key = String(id?._id || id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
TestPanelSchema.pre('validate', function dedupeTests(next) {
  if (Array.isArray(this.tests)) this.tests = uniqueIds(this.tests);
  next();
});
TestPanelSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function dedupeUpdatedTests(next) {
  const update = this.getUpdate() || {};
  if (Array.isArray(update.tests)) update.tests = uniqueIds(update.tests);
  if (Array.isArray(update.$set?.tests)) update.$set.tests = uniqueIds(update.$set.tests);
  next();
});
TestPanelSchema.statics.uniqueTestIds = uniqueIds;

module.exports = mongoose.model('TestPanel', TestPanelSchema);
