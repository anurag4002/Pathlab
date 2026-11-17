// Referring-doctor logins ('Referrer'): admin gives the login, the doctor
// sees only cases referred by them, only signed reports open, every staff
// API refuses the login, and doctor requests land in Bookings tagged with
// the doctor. The pathologist 'Doctor' role and staff are unchanged.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'referrer-access-fixture';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

let database, server, base;
let User, Doctor, Patient, Bill, Report, Inquiry, Branch, WebBrowser;
let admin, employee, pathologist, adminToken, employeeToken, pathologistToken;
let doctorA, doctorB, cbc, pkg, panel, otherBranch;
let billA1, billA2, billB1, billWalkIn, reportA1, reportA2, reportB1;
let doctorToken;
const DOCTOR_PHONE = '9876500011';
const DOCTOR_PASSWORD = 'fixture-pass-1';

const sign = (user) => jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET);
async function api(method, path, { token, body, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const response = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (raw) return response;
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { text }; }
  return { status: response.status, body: json, headers: response.headers };
}
const loginAs = (email, password) => api('POST', '/api/auth/login', { body: { email, password } });

before(async () => {
  database = await MongoMemoryServer.create();
  // The app must never reach any database but this throwaway one.
  process.env.MONGO_URI = database.getUri();
  await mongoose.connect(database.getUri());
  global.mongoose = { conn: mongoose, promise: Promise.resolve(mongoose) };
  for (const name of ['Agent', 'TestPanel', 'Sequence', 'LabProfile', 'Activity', 'USGCase', 'XrayCase', 'ModalityCase', 'BillItem']) require(`../src/models/${name}`);
  User = require('../src/models/User');
  Doctor = require('../src/models/Doctor');
  Patient = require('../src/models/Patient');
  Bill = require('../src/models/Bill');
  Report = require('../src/models/Report');
  Inquiry = require('../src/models/Inquiry');
  Branch = require('../src/models/Branch');
  WebBrowser = require('../src/models/WebBrowser');
  const Test = require('../src/models/Test');
  const TestCategory = require('../src/models/TestCategory');
  const TestPackage = require('../src/models/TestPackage');
  await Promise.all([Patient.init(), Bill.init(), User.init()]);

  const main = await require('../src/utils/ensureBranch').ensureMainBranch();
  otherBranch = await Branch.create({ name: 'North', code: 'NORTH', status: 'Active' });
  admin = await User.create({ name: 'Fixture Admin', email: 'admin@example.test', password: 'fixture-only', role: 'Admin', branch: main._id });
  employee = await User.create({ name: 'Fixture Employee', email: 'employee@example.test', phone: '9000000002', password: 'fixture-only', role: 'Employee', branch: main._id });
  pathologist = await User.create({ name: 'Fixture Pathologist', email: 'patho@example.test', password: 'fixture-only', role: 'Doctor', branch: main._id });
  adminToken = sign(admin); employeeToken = sign(employee); pathologistToken = sign(pathologist);

  doctorA = await Doctor.create({ name: 'Dr. Asha Referrer', phone: DOCTOR_PHONE, clinicHospital: 'Fixture Clinic' });
  doctorB = await Doctor.create({ name: 'Dr. Bala Other', phone: '9876500022' });

  const category = await TestCategory.create({ name: 'Haematology' });
  cbc = await Test.create({ name: 'CBC', code: 'CBC', category: category._id, sampleType: 'Blood', price: 300,
    parameters: [{ code: 'HB', name: 'Haemoglobin', unit: 'g/dL' }] });
  pkg = await TestPackage.create({ name: 'Fever Package', price: 900, includedTests: [cbc._id] });
  panel = await require('../src/models/TestPanel').create({ name: 'Blood Panel', price: 350, tests: [cbc._id] });

  const patientService = require('../src/services/patientService');
  const billService = require('../src/services/billService');
  const line = { itemType: 'Test', itemId: cbc._id, name: cbc.name, price: cbc.price };
  const p1 = await patientService.createPatient({ name: 'Ravi Kumar', title: 'Mr.', age: 40, birthYear: 1986, gender: 'Male', phone: '9111111111' });
  const p2 = await patientService.createPatient({ name: 'Sita Devi', title: 'Mrs.', age: 35, birthYear: 1991, gender: 'Female', phone: '9222222222' });
  const p3 = await patientService.createPatient({ name: 'Walk In', title: 'Mr.', age: 22, birthYear: 2004, gender: 'Male', phone: '9333333333' });
  billA1 = await billService.createBill({ patient: p1._id, department: 'LAB', referringDoctor: doctorA._id, items: [line], paidAmount: 100 }, admin._id);
  billA2 = await billService.createBill({ patient: p2._id, department: 'LAB', referringDoctor: doctorA._id, items: [line] }, admin._id);
  billB1 = await billService.createBill({ patient: p2._id, department: 'LAB', referringDoctor: doctorB._id, items: [line] }, admin._id);
  billWalkIn = await billService.createBill({ patient: p3._id, department: 'LAB', items: [line] }, admin._id);
  reportA1 = await Report.findOne({ bill: billA1._id });
  reportA2 = await Report.findOne({ bill: billA2._id });
  reportB1 = await Report.findOne({ bill: billB1._id });
  const signed = { status: 'Signed', results: [{ testName: 'Haemoglobin', value: '13.5', unit: 'g/dL', flag: 'N' }] };
  await Report.updateOne({ _id: reportA1._id }, { $set: signed });
  await Report.updateOne({ _id: reportB1._id }, { $set: signed });
  await Report.updateOne({ _id: reportA2._id }, { $set: { status: 'Reported', results: [{ testName: 'Haemoglobin', value: '9.1', unit: 'g/dL', flag: 'L' }] } });

  const app = require('../src/app');
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await database?.stop();
});

test('admin gives a referring doctor a login with the mobile number as ID', async () => {
  const notAdmin = await api('POST', `/api/doctors/${doctorA._id}/login`, { token: employeeToken, body: { loginId: DOCTOR_PHONE, password: DOCTOR_PASSWORD } });
  assert.equal(notAdmin.status, 403, 'only an admin gives logins');
  const badPhone = await api('POST', `/api/doctors/${doctorA._id}/login`, { token: adminToken, body: { loginId: '12345', password: DOCTOR_PASSWORD } });
  assert.equal(badPhone.status, 400);
  const taken = await api('POST', `/api/doctors/${doctorA._id}/login`, { token: adminToken, body: { loginId: '+91 90000 00002', password: DOCTOR_PASSWORD } });
  assert.equal(taken.status, 409, 'a mobile number already used by staff is refused');
  const shortPassword = await api('POST', `/api/doctors/${doctorA._id}/login`, { token: adminToken, body: { loginId: DOCTOR_PHONE, password: 'short' } });
  assert.equal(shortPassword.status, 400);

  const given = await api('POST', `/api/doctors/${doctorA._id}/login`, { token: adminToken, body: { loginId: DOCTOR_PHONE, password: DOCTOR_PASSWORD } });
  assert.equal(given.status, 201, JSON.stringify(given.body));
  assert.equal(given.body.data.loginId, DOCTOR_PHONE);
  assert.equal(given.body.data.status, 'Active');
  const again = await api('POST', `/api/doctors/${doctorA._id}/login`, { token: adminToken, body: { loginId: DOCTOR_PHONE, password: DOCTOR_PASSWORD } });
  assert.equal(again.status, 409);
  const user = await User.findById(given.body.data.userId);
  assert.equal(user.role, 'Referrer');
  assert.equal(String((await Doctor.findById(doctorA._id)).linkedUser), String(user._id));
  const logins = await api('GET', '/api/doctors/logins', { token: adminToken });
  assert.equal(logins.status, 200);
  assert.deepEqual(logins.body.data.map((l) => String(l.doctorId)), [String(doctorA._id)]);
  const staffList = await api('GET', '/api/users', { token: adminToken });
  assert.ok(staffList.body.data.every((u) => u.role !== 'Referrer'), 'doctor logins stay out of the staff list');

  const login = await loginAs(DOCTOR_PHONE, DOCTOR_PASSWORD);
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.data.user.role, 'Referrer');
  doctorToken = login.body.data.token;
  const me = await api('GET', '/api/auth/me', { token: doctorToken });
  assert.equal(me.status, 200);
});

test('every staff API refuses the referring doctor', async () => {
  const blocked = [
    ['GET', '/api/patients'],
    ['GET', `/api/patients/${billA1.patient}`],
    ['GET', '/api/bills'],
    ['GET', `/api/bills/${billA1._id}`],
    ['GET', `/api/bills/${billA1._id}/pdf`],
    ['PUT', `/api/bills/${billA1._id}`],
    ['GET', `/api/reports/${reportA1._id}`],
    ['GET', `/api/reports/${reportA1._id}/pdf`],
    ['GET', `/api/reports/${reportA1._id}/entry`],
    ['PUT', `/api/reports/${reportA1._id}/results`],
    ['GET', '/api/reports/pending-cases'],
    ['GET', '/api/inquiries'],
    ['PUT', `/api/inquiries/${new mongoose.Types.ObjectId()}`],
    ['GET', '/api/usg'],
    ['GET', '/api/xray'],
    ['GET', '/api/doctors'],
    ['GET', '/api/doctor/cases'],
    ['GET', '/api/dashboard/summary'],
    ['GET', '/api/dashboard/referral'],
    ['GET', '/api/setup/lab-profile'],
    ['GET', '/api/settings/tat'],
    ['GET', '/api/users'],
    ['GET', '/api/transactions'],
    ['GET', '/api/analysis/test-usage'],
    ['GET', '/api/export/bills'],
    ['GET', '/api/REFERRER/../bills'],
    ['GET', '/api/no-such-router-yet']
  ];
  for (const [method, path] of blocked) {
    const response = await api(method, path, { token: doctorToken, body: method === 'GET' ? undefined : { results: [] } });
    assert.ok([403, 404].includes(response.status), `${method} ${path} -> ${response.status}`);
    if (response.status === 200) assert.fail(`${method} ${path} returned data`);
  }
  for (const [method, path] of blocked.slice(0, -2)) {
    const response = await api(method, path, { token: doctorToken, body: method === 'GET' ? undefined : { results: [] } });
    assert.equal(response.status, 403, `${method} ${path} must be refused, got ${response.status}`);
  }
  assert.equal((await Report.findById(reportA1._id)).results[0].value, '13.5', 'no result changed');
});

test('my patients shows only cases referred by this doctor, with report status only', async () => {
  const list = await api('GET', '/api/referrer/cases', { token: doctorToken });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const rows = list.body.data.cases;
  assert.deepEqual(rows.map((r) => r.billNumber).sort(), [billA1.billNumber, billA2.billNumber].sort());
  const a1 = rows.find((r) => r.billNumber === billA1.billNumber);
  assert.equal(a1.patient.name, 'Ravi Kumar');
  assert.deepEqual(a1.tests, ['CBC']);
  assert.equal(a1.totalAmount, 300);
  assert.equal(a1.paidAmount, 100);
  assert.equal(a1.dueAmount, 200);
  assert.deepEqual(a1.reports.map((r) => [r.kind, r.ready]), [['lab', true]]);
  const a2 = rows.find((r) => r.billNumber === billA2.billNumber);
  assert.deepEqual(a2.reports.map((r) => r.ready), [false], 'Reported but not signed is still processing');
  const text = JSON.stringify(list.body);
  assert.ok(!text.includes('13.5') && !text.includes('9.1') && !text.includes('Haemoglobin'), 'no result values in the list');
  assert.ok(!text.includes('Sita Devi') || rows.some((r) => r.patient.name === 'Sita Devi'), 'other doctors’ cases stay hidden');
  assert.ok(!text.includes('Walk In') && !text.includes(billB1.billNumber) && !text.includes(billWalkIn.billNumber));

  const searched = await api('GET', '/api/referrer/cases?search=ravi', { token: doctorToken });
  assert.deepEqual(searched.body.data.cases.map((r) => r.billNumber), [billA1.billNumber]);
  const byTest = await api('GET', '/api/referrer/cases?search=CBC', { token: doctorToken });
  assert.equal(byTest.body.data.cases.length, 2);
  const walkIn = await api('GET', '/api/referrer/cases?search=Walk', { token: doctorToken });
  assert.equal(walkIn.body.data.cases.length, 0);
  const future = await api('GET', '/api/referrer/cases?from=2099-01-01', { token: doctorToken });
  assert.equal(future.body.data.cases.length, 0);
});

test('only their own signed report can be downloaded or shared', async () => {
  const pdf = await api('GET', `/api/referrer/reports/${reportA1._id}/pdf`, { token: doctorToken, raw: true });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type'), /application\/pdf/);
  assert.ok((await pdf.arrayBuffer()).byteLength > 1000);

  const processing = await api('GET', `/api/referrer/reports/${reportA2._id}/pdf`, { token: doctorToken });
  assert.equal(processing.status, 403, 'a report that is not signed is refused');
  const someoneElse = await api('GET', `/api/referrer/reports/${reportB1._id}/pdf`, { token: doctorToken });
  assert.equal(someoneElse.status, 404, 'another doctor’s signed report is refused');
  const junk = await api('GET', '/api/referrer/reports/not-an-id/pdf', { token: doctorToken });
  assert.equal(junk.status, 404);

  const share = await api('POST', `/api/referrer/reports/${reportA1._id}/share`, { token: doctorToken });
  assert.equal(share.status, 200);
  assert.match(share.body.data.verifyUrl, /\/r\/[a-f0-9]+\.[a-f0-9]+$/);
  assert.equal((await api('POST', `/api/referrer/reports/${reportA2._id}/share`, { token: doctorToken })).status, 403);
  assert.equal((await api('POST', `/api/referrer/reports/${reportB1._id}/share`, { token: doctorToken })).status, 404);

  const billPdf = await api('GET', `/api/referrer/bills/${billA2._id}/pdf`, { token: doctorToken, raw: true });
  assert.equal(billPdf.status, 200);
  assert.match(billPdf.headers.get('content-type'), /application\/pdf/);
  assert.equal((await api('GET', `/api/referrer/bills/${billB1._id}/pdf`, { token: doctorToken })).status, 404);
  assert.equal((await api('GET', `/api/referrer/bills/${billWalkIn._id}/pdf`, { token: doctorToken })).status, 404);
  const billShare = await api('POST', `/api/referrer/bills/${billA1._id}/share`, { token: doctorToken });
  assert.equal(billShare.status, 200);
  assert.ok(billShare.body.data.verifyUrl);
  assert.equal((await api('GET', `/api/referrer/scans/usg/${new mongoose.Types.ObjectId()}/pdf`, { token: doctorToken })).status, 404);
});

test('a doctor request becomes a booking tagged with the doctor, priced by the lab', async () => {
  const bad = await api('POST', '/api/referrer/requests', { token: doctorToken, body: { name: 'New Patient', phone: '123', items: [{ kind: 'Test', refId: String(cbc._id) }] } });
  assert.equal(bad.status, 400);
  const created = await api('POST', '/api/referrer/requests', { token: doctorToken, body: {
    name: 'Meena Shah', phone: '+91 98111 22333', age: 52, gender: 'Female', note: 'Fasting sample',
    items: [{ kind: 'Test', refId: String(cbc._id), price: 1 }, { kind: 'Package', refId: String(pkg._id), price: 1 }],
    doctorId: String(doctorB._id)
  } });
  assert.equal(created.status, 404, 'cannot send a request in another doctor’s name');
  const ok = await api('POST', '/api/referrer/requests', { token: doctorToken, body: {
    name: 'Meena Shah', phone: '+91 98111 22333', age: 52, gender: 'Female', note: 'Fasting sample',
    items: [{ kind: 'Test', refId: String(cbc._id), price: 1 }, { kind: 'Package', refId: String(pkg._id), price: 1 }, { kind: 'Panel', refId: String(panel._id), price: 1 }]
  } });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const inquiry = await Inquiry.findById(ok.body.data._id).lean();
  assert.equal(String(inquiry.referringDoctor), String(doctorA._id));
  assert.equal(inquiry.source, 'doctor');
  assert.equal(inquiry.phone, '9811122333');
  assert.equal(inquiry.age, 52);
  assert.deepEqual(inquiry.items.map((it) => [it.kind, it.name, it.price]), [['Test', 'CBC', 300], ['Package', 'Fever Package', 900], ['Panel', 'Blood Panel', 350]], 'names and prices come from the lab, not the doctor');
  const list = await api('GET', '/api/referrer/catalog', { token: doctorToken });
  assert.deepEqual(list.body.data.map((o) => o.kind).sort(), ['Package', 'Panel', 'Test']);
  assert.ok(list.body.data.every((o) => o.price === undefined), 'the request screen shows no prices');
  const main = await Branch.findOne({ code: 'MAIN' });
  assert.equal(String(inquiry.branch), String(main._id), 'no doctor branch: Main');

  // With a branch set for the doctor, requests go to that branch.
  assert.equal((await api('PATCH', `/api/doctors/${doctorA._id}/login`, { token: adminToken, body: { branch: String(otherBranch._id) } })).status, 200);
  const north = await api('POST', '/api/referrer/requests', { token: doctorToken, body: { name: 'Arun Pal', phone: '9811122444', items: [{ kind: 'Test', refId: String(cbc._id) }] } });
  assert.equal(String((await Inquiry.findById(north.body.data._id)).branch), String(otherBranch._id));

  const mine = await api('GET', '/api/referrer/requests', { token: doctorToken });
  assert.deepEqual(mine.body.data.map((r) => r.name).sort(), ['Arun Pal', 'Meena Shah']);

  const bookings = await api('GET', '/api/inquiries', { token: adminToken });
  const booking = bookings.body.data.inquiries.find((i) => i.name === 'Meena Shah');
  assert.equal(booking.referringDoctor.name, 'Dr. Asha Referrer', 'Bookings knows who referred the patient');
  const mainStaff = await api('GET', '/api/inquiries', { token: employeeToken });
  assert.ok(mainStaff.body.data.inquiries.some((i) => i.name === 'Meena Shah'));
  assert.ok(!mainStaff.body.data.inquiries.some((i) => i.name === 'Arun Pal'), 'North branch request stays with North');
});

test('reset password ends old sessions; turning the login off blocks it', async () => {
  const reset = await api('PUT', `/api/doctors/${doctorA._id}/login/password`, { token: adminToken, body: { password: 'fixture-pass-2' } });
  assert.equal(reset.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal((await api('GET', '/api/referrer/cases', { token: doctorToken })).status, 401, 'old session ended');
  assert.equal((await loginAs(DOCTOR_PHONE, DOCTOR_PASSWORD)).status, 401);
  const fresh = await loginAs(DOCTOR_PHONE, 'fixture-pass-2');
  assert.equal(fresh.status, 200);
  doctorToken = fresh.body.data.token;
  assert.equal((await api('GET', '/api/referrer/cases', { token: doctorToken })).status, 200);

  // Approved-computer list: staff need an approved browser; doctors use their phones.
  await WebBrowser.create({ name: 'Front desk', code: 'DESK-1', status: 'Active' });
  assert.equal((await loginAs(DOCTOR_PHONE, 'fixture-pass-2')).status, 200);
  assert.equal((await loginAs('employee@example.test', 'fixture-only')).status, 403);
  await WebBrowser.deleteMany({});

  const off = await api('PATCH', `/api/doctors/${doctorA._id}/login`, { token: adminToken, body: { status: 'Inactive' } });
  assert.equal(off.status, 200);
  assert.equal((await api('GET', '/api/referrer/cases', { token: doctorToken })).status, 403);
  assert.equal((await loginAs(DOCTOR_PHONE, 'fixture-pass-2')).status, 403);
  assert.equal((await api('PATCH', `/api/doctors/${doctorA._id}/login`, { token: adminToken, body: { status: 'Active' } })).status, 200);
  assert.equal((await api('GET', '/api/referrer/cases', { token: doctorToken })).status, 200);
});

test('pathologist (Doctor), Employee and Admin keep their access', async () => {
  for (const token of [pathologistToken, employeeToken, adminToken]) {
    assert.equal((await api('GET', '/api/patients', { token })).status, 200);
    assert.equal((await api('GET', '/api/bills', { token })).status, 200);
    const pdf = await api('GET', `/api/reports/${reportB1._id}/pdf`, { token, raw: true });
    assert.equal(pdf.status, 200);
    await pdf.arrayBuffer();
    assert.equal((await api('GET', '/api/referrer/cases', { token })).status, 403, 'staff do not use the doctor API');
  }
  assert.equal((await api('GET', '/api/reports/pending-cases', { token: pathologistToken })).status, 200);
  assert.equal((await api('GET', '/api/inquiries', { token: pathologistToken })).status, 403, 'unchanged: bookings were never for the Doctor role');
  assert.equal((await User.findById(pathologist._id)).role, 'Doctor');
});

test('startup migration moves only invite-linked Doctor logins to Referrer, once', async () => {
  const { migrateReferrerUsers } = require('../src/utils/migrateReferrers');
  const invited = await User.create({ name: 'Invited Doc', email: 'invited@example.test', password: 'fixture-only', role: 'Doctor' });
  await Doctor.create({ name: 'Invited Doc', phone: '9876500033', linkedUser: invited._id });
  const linkedAdmin = await User.create({ name: 'Linked Admin', email: 'linked-admin@example.test', password: 'fixture-only', role: 'Admin' });
  await Doctor.create({ name: 'Linked Admin', phone: '9876500044', linkedUser: linkedAdmin._id });
  assert.deepEqual(await migrateReferrerUsers(), { moved: 1 });
  assert.equal((await User.findById(invited._id)).role, 'Referrer');
  assert.equal((await User.findById(pathologist._id)).role, 'Doctor', 'unlinked pathologist untouched');
  assert.equal((await User.findById(linkedAdmin._id)).role, 'Admin', 'only Doctor-role logins move');
  assert.deepEqual(await migrateReferrerUsers(), { moved: 0 }, 'safe to run again');
});

test('invite acceptance gives a Referrer login and never converts a staff login', async () => {
  const DoctorInvite = require('../src/models/DoctorInvite');
  await Doctor.create({ name: 'Dr. Invitee', phone: '9876500055', email: 'invitee@example.test' });
  await DoctorInvite.create({ name: 'Dr. Invitee', email: 'invitee@example.test', token: 'invite-token-1', expiresAt: new Date(Date.now() + 60000) });
  const accepted = await api('POST', '/api/doctor/invites/accept', { body: { token: 'invite-token-1', password: 'fixture-pass-3' } });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal((await User.findOne({ email: 'invitee@example.test' })).role, 'Referrer');
  await DoctorInvite.create({ name: 'Employee', email: 'employee@example.test', token: 'invite-token-2', expiresAt: new Date(Date.now() + 60000) });
  const staff = await api('POST', '/api/doctor/invites/accept', { body: { token: 'invite-token-2', password: 'fixture-pass-3' } });
  assert.equal(staff.status, 409);
  assert.equal((await User.findById(employee._id)).role, 'Employee');
});
