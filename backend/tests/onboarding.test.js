// Tests for backend/src/constants/onboarding.js
// Covers: 11-step checklist length and key uniqueness.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/purepathlab-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ONBOARDING_STEPS } = require('../src/constants/onboarding');

describe('onboarding constants', () => {
  it('has exactly 11 steps', () => {
    assert.equal(ONBOARDING_STEPS.length, 11);
  });

  it('has unique non-empty keys', () => {
    const keys = ONBOARDING_STEPS.map((s) => s.key);
    for (const k of keys) assert.ok(typeof k === 'string' && k.length > 0, `bad key: ${k}`);
    assert.equal(new Set(keys).size, keys.length, 'onboarding keys must be unique');
  });

  it('every step has a title and description', () => {
    for (const s of ONBOARDING_STEPS) {
      assert.ok(s.title && s.title.length > 0, `step ${s.key} missing title`);
      assert.ok(typeof s.description === 'string', `step ${s.key} missing description`);
    }
  });
});

it('singleton settings survive simultaneous first requests (no duplicate-key 500)', async () => {
  const mongoose = require('mongoose');
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const { findOrCreate } = require('../src/utils/findOrCreate');
  const server = await MongoMemoryServer.create();
  const connection = await mongoose.createConnection(server.getUri()).asPromise();
  const Model = connection.model('SingletonProbe', new mongoose.Schema({ key: { type: String, unique: true }, count: Number }));
  await Model.init();
  const docs = await Promise.all(Array.from({ length: 8 }, () => findOrCreate(Model, { key: 'default' }, { count: 1 })));
  require('node:assert/strict').ok(docs.every((doc) => doc && doc.key === 'default'));
  require('node:assert/strict').equal(await Model.countDocuments(), 1);
  await connection.close(); await server.stop();
});
