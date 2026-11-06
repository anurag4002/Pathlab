const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true,
    index: true
  },
  address: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
    index: true
  }
}, { timestamps: true });

// Signed-in users are cached briefly by the auth middleware; any change to
// a user or branch drops that cache so it applies on the next request.
{
  const { clearUserCache } = require('../utils/userCache');
  BranchSchema.post('save', clearUserCache);
  BranchSchema.post(['findOneAndUpdate', 'updateOne', 'updateMany', 'findOneAndDelete', 'deleteOne', 'deleteMany'], clearUserCache);
}

module.exports = mongoose.model('Branch', BranchSchema);
