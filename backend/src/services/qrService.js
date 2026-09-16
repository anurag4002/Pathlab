const crypto = require('crypto');
const QRCode = require('qrcode');
const { PUBLIC_BASE_URL, CLIENT_URL } = require('../config/environment');

// Signed public tokens: <random 16B hex>.<hmac 8 hex> so /r/:token URLs
// cannot be enumerated and tampering is detectable without a DB lookup.
function signToken(raw, secret) {
  const h = crypto.createHmac('sha256', secret).update(raw).digest('hex').slice(0, 8);
  return `${raw}.${h}`;
}

function newPublicToken(secret) {
  const raw = crypto.randomBytes(16).toString('hex');
  return signToken(raw, secret);
}

function verifyPublicToken(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return false;
  const raw = token.slice(0, idx);
  return signToken(raw, secret) === token;
}

function publicBase() {
  return (PUBLIC_BASE_URL || CLIENT_URL || '').replace(/\/$/, '');
}

function reportVerifyUrl(qrToken) {
  return `${publicBase()}/r/${qrToken}`;
}

function billVerifyUrl(qrToken) {
  return `${publicBase()}/r/bill/${qrToken}`;
}

async function qrDataURL(text, opts = {}) {
  return QRCode.toDataURL(text, { margin: 1, width: 220, ...opts });
}

async function qrBuffer(text, opts = {}) {
  return QRCode.toBuffer(text, { margin: 1, width: 220, ...opts });
}

module.exports = {
  newPublicToken,
  verifyPublicToken,
  signToken,
  publicBase,
  reportVerifyUrl,
  billVerifyUrl,
  qrDataURL,
  qrBuffer
};
