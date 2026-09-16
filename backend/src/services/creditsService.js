const SmsCredit = require('../models/SmsCredit');

async function ledger() {
  let doc = await SmsCredit.findOne({ key: 'default' });
  if (!doc) {
    doc = await SmsCredit.create({ key: 'default', balance: 100, history: [{ kind: 'topup', credits: 100, note: 'Initial credits' }] });
  }
  return doc;
}

async function getBalance() {
  const doc = await ledger();
  return doc.balance;
}

async function spend(n, note = '') {
  const doc = await ledger();
  if (doc.balance < n) {
    const err = new Error('Insufficient message credits');
    err.statusCode = 402;
    throw err;
  }
  doc.balance -= n;
  doc.history.push({ kind: 'spend', credits: n, note, at: new Date() });
  await doc.save();
  return doc.balance;
}

async function topup(n, note = '') {
  if (!(n > 0)) {
    const err = new Error('Top-up credits must be positive');
    err.statusCode = 400;
    throw err;
  }
  const doc = await ledger();
  doc.balance += n;
  doc.history.push({ kind: 'topup', credits: n, note, at: new Date() });
  await doc.save();
  return doc.balance;
}

async function getHistory(limit = 50) {
  const doc = await ledger();
  return { balance: doc.balance, history: doc.history.slice(-limit).reverse() };
}

module.exports = { getBalance, spend, topup, getHistory };
