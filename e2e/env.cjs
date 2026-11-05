// Isolated end-to-end environment.
// - A throwaway in-memory MongoDB, seeded with a READ-ONLY copy of the lab's
//   catalog and settings (no patients, bills, reports or users).
// - The real backend app, loaded in this process only: requests from the
//   test browser are handed to it directly (no network port is opened).
// - SMS / WhatsApp / email providers replaced by recorders: nothing is sent.
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const B = path.resolve(__dirname, '../backend');

const COPY = ['testcategories', 'tests', 'testpanels', 'testpackages', 'labprofiles', 'signatures', 'notificationtemplates', 'tatconfigs', 'doctors', 'agents', 'branches'];

function prodUri() {
  const env = fs.readFileSync(path.resolve(B, '../.env'), 'utf8');
  const line = env.split(/\r?\n/).find(l => /^MONGO_URI=/.test(l));
  return line.slice('MONGO_URI='.length).trim().replace(/^["']|["']$/g, '');
}

async function start() {
  const { MongoMemoryServer } = require(B + '/node_modules/mongodb-memory-server');
  const memory = await MongoMemoryServer.create();
  process.env.MONGO_URI = memory.getUri('pathlab_e2e');
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(24).toString('hex');

  // Read-only copy of catalog/config from the lab database.
  const mongoose = require(B + '/node_modules/mongoose');
  const source = await mongoose.createConnection(prodUri(), { serverSelectionTimeoutMS: 15000 }).asPromise();
  const target = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  const copied = {};
  for (const name of COPY) {
    const docs = await source.db.collection(name).find({}).toArray();
    if (docs.length) await target.db.collection(name).insertMany(docs);
    copied[name] = docs.length;
  }
  await source.close();
  await target.close();

  // Messages are recorded, never sent.
  const sent = [];
  const notify = require(B + '/src/services/notificationService');
  notify.sendSmsViaProvider = async (to, text) => { sent.push({ channel: 'sms', to, text }); return { ok: true, simulated: true }; };
  notify.sendWhatsappViaProvider = async (to, text) => { sent.push({ channel: 'whatsapp', to, text }); return { ok: true, simulated: true }; };
  notify.sendEmailViaProvider = async (to, subject, text) => { sent.push({ channel: 'email', to, subject, text }); return { ok: true, simulated: true }; };
  const realTemplated = notify.sendTemplated;
  notify.sendTemplated = async (channel, key, to, vars) => { sent.push({ channel, key, to, vars }); return { ok: true, simulated: true }; };
  void realTemplated;

  require(B + '/src/config/environment');
  await require(B + '/src/config/database')();
  for (const m of fs.readdirSync(B + '/src/models')) require(B + '/src/models/' + m);

  // Test admin created only in the throwaway DB.
  const User = mongoose.model('User');
  const password = crypto.randomBytes(9).toString('base64url') + 'A1!';
  const admin = await User.create({ name: 'E2E Admin', email: 'e2e.admin@example.test', phone: '9000000001', password, role: 'Admin', status: 'Active' });
  // Same as server boot: Main branch exists and branchless users/records join it.
  await require(B + '/src/utils/ensureBranch').backfillBranchRefs();
  const app = require(B + '/src/app');

  // Hand a browser request straight to the app (no listening socket).
  const inject = ({ method, url, headers = {}, body }) => new Promise((resolve) => {
    const socket = new net.Socket();
    Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1' });
    const req = new http.IncomingMessage(socket);
    req.method = method; req.url = url;
    // The stand-in socket never connects; a real client request is not "aborted".
    const emit = req.emit.bind(req); req.emit = (event, ...args) => (event === 'aborted' ? false : emit(event, ...args));
    req.headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    if (body && body.length) req.headers['content-length'] = String(body.length);
    if (body && body.length) req.push(body);
    req.push(null);
    const res = new http.ServerResponse(req);
    const chunks = [];
    res.write = (chunk, enc) => { if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc)); return true; };
    res.end = (chunk, enc) => {
      if (chunk && typeof chunk !== 'function') chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
      const headersOut = {};
      for (const [k, v] of Object.entries(res.getHeaders())) headersOut[k] = Array.isArray(v) ? v.join(', ') : String(v);
      resolve({ status: res.statusCode, headers: headersOut, body: Buffer.concat(chunks) });
      return res;
    };
    app.handle(req, res, () => resolve({ status: 404, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"success":false,"message":"not found"}') }));
  });

  const stop = async () => { await mongoose.disconnect(); await memory.stop(); };
  return { app, inject, admin: { email: admin.email, password }, copied, sent, mongoose, stop };
}

module.exports = { start };
