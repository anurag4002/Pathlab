process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'change-password-test';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../src/models/User');
require('../src/models/Activity');
const auth = require('../src/controllers/authController');
let database, user;
const first = `T-${crypto.randomBytes(5).toString('hex')}`;
const second = `N-${crypto.randomBytes(5).toString('hex')}`;
const call = async (body) => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  let failure = null;
  await auth.changePassword({ user: { _id: user._id }, body }, res, (error) => { failure = error; });
  if (failure) throw failure;
  return res;
};
before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  user = await User.create({ name: 'Admin', email: 'self.change@example.test', password: first, role: 'Admin', status: 'Active' });
});
after(async () => { await mongoose.disconnect(); await database?.stop(); });

test('a signed-in user changes their own password only with the right current one', async () => {
  assert.equal((await call({ currentPassword: 'wrong-one', newPassword: second })).statusCode, 400, 'wrong current password refused (400, no sign-out)');
  assert.equal((await call({ currentPassword: first, newPassword: '123' })).statusCode, 400, 'too short refused');
  assert.equal((await call({ currentPassword: first, newPassword: first })).statusCode, 400, 'same password refused');
  assert.ok(await (await User.findById(user._id)).comparePassword(first), 'unchanged after refusals');
  const ok = await call({ currentPassword: first, newPassword: second });
  assert.equal(ok.statusCode, 200);
  const saved = await User.findById(user._id);
  assert.ok(await saved.comparePassword(second), 'new password works');
  assert.ok(!(await saved.comparePassword(first)), 'old password no longer works');
  assert.notEqual(saved.password, second, 'stored hashed, not plain');
  assert.equal(await mongoose.model('Activity').countDocuments({ action: 'Change Password' }), 1);
});
