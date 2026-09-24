const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MONGO_URI, UPLOAD_DIR } = require('../config/environment');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Agent = require('../models/Agent');
const TestCategory = require('../models/TestCategory');
const Test = require('../models/Test');
const TestPackage = require('../models/TestPackage');
const TestPanel = require('../models/TestPanel');
const Interpretation = require('../models/Interpretation');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Activity = require('../models/Activity');
const Report = require('../models/Report');
const USGCase = require('../models/USGCase');
const XrayCase = require('../models/XrayCase');
const Signature = require('../models/Signature');
const Inquiry = require('../models/Inquiry');
const LabProfile = require('../models/LabProfile');
const SupportTicket = require('../models/SupportTicket');
const WebBrowser = require('../models/WebBrowser');
const Job = require('../models/Job');
const seedData = require('./seedData');

// ---- helpers (deterministic: fixed-seed PRNG, no Math.random) ----
const atDay = (daysAgo, h = 10, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d;
};
const compact = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
const plusHours = (d, h) => new Date(d.getTime() + h * 3600 * 1000);
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(20260824);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const seedDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear collections (reports/cases first — they reference bills/patients)
    await Report.deleteMany();
    await USGCase.deleteMany();
    await XrayCase.deleteMany();
    await BillItem.deleteMany();
    await Bill.deleteMany();
    await Transaction.deleteMany();
    await Inquiry.deleteMany();
    await Job.deleteMany();
    await Activity.deleteMany();
    await User.deleteMany();
    await Patient.deleteMany();
    await Doctor.deleteMany();
    await Agent.deleteMany();
    await TestCategory.deleteMany();
    await Test.deleteMany();
    await TestPackage.deleteMany();
    await TestPanel.deleteMany();
    await Interpretation.deleteMany();
    await Expense.deleteMany();
    await Signature.deleteMany();
    await LabProfile.deleteMany();
    await SupportTicket.deleteMany();
    await WebBrowser.deleteMany();
    console.log('Database collections cleared.');

    // ---- Users / Doctors / Agents ----
    const users = await User.create(seedData.users);
    console.log(`Seeded ${users.length} users.`);
    const adminUser = users.find((u) => u.role === 'Admin');
    const staffUser = users.find((u) => u.role === 'Employee');

    const doctors = await Doctor.create(seedData.doctors);
    console.log(`Seeded ${doctors.length} doctors.`);

    const agents = await Agent.create(seedData.agents);
    console.log(`Seeded ${agents.length} agents.`);

    // ---- Catalog ----
    const categories = await TestCategory.create(seedData.categories);
    console.log(`Seeded ${categories.length} categories.`);

    const testsToSeed = seedData.tests.map((test) => {
      const category = categories.find((c) => c.name === test.categoryName);
      return {
        name: test.name,
        code: test.code,
        category: category._id,
        sampleType: test.sampleType,
        unit: test.unit,
        referenceRange: test.referenceRange,
        maleReferenceRange: test.maleReferenceRange,
        femaleReferenceRange: test.femaleReferenceRange,
        price: test.price,
        description: test.description,
        interpretation: test.interpretation,
        status: 'Active'
      };
    });
    const tests = await Test.create(testsToSeed);
    console.log(`Seeded ${tests.length} tests.`);
    const testByCode = {};
    tests.forEach((t) => { testByCode[t.code] = t; });
    const testCodes = Object.keys(testByCode);

    const packagesToSeed = seedData.packages.map((pkg) => {
      const pkgTests = tests.filter((t) => pkg.testCodes.includes(t.code)).map((t) => t._id);
      return {
        name: pkg.name,
        price: pkg.price,
        gender: pkg.gender,
        includedTests: pkgTests,
        description: pkg.description,
        status: 'Active'
      };
    });
    const packages = await TestPackage.create(packagesToSeed);
    console.log(`Seeded ${packages.length} packages.`);
    const pkgByName = {};
    packages.forEach((p) => { pkgByName[p.name] = p; });
    const pkgNames = Object.keys(pkgByName);

    const panelsToSeed = (seedData.panels || []).map((p) => ({
      name: p.name,
      price: p.price,
      tests: tests.filter((t) => p.testCodes.includes(t.code)).map((t) => t._id),
      description: p.description,
      status: 'Active'
    }));
    const panels = await TestPanel.create(panelsToSeed);
    console.log(`Seeded ${panels.length} panels.`);

    const interpsToSeed = (seedData.interpretations || []).map((r) => ({
      test: testByCode[r.testCode]._id,
      resultCondition: r.resultCondition,
      interpretationText: r.interpretationText,
      normalAbnormalGuidance: r.normalAbnormalGuidance,
      status: 'Active'
    }));
    await Interpretation.create(interpsToSeed);
    console.log(`Seeded ${interpsToSeed.length} interpretations.`);

    // ---- Lab profile ----
    await LabProfile.create({
      labName: 'Pure Path Lab',
      tagline: 'Pathology & Diagnostic Center',
      phone: '9810012345',
      address: 'G-7, Vikas Marg, Laxmi Nagar, Delhi 110092',
      email: 'care@purepathlab.in',
      website: 'https://purepathlab.in',
      smsEnabled: true,
      whatsappEnabled: true,
      emailEnabled: true,
      smsSenderId: 'PUREPATH',
      googleReviewLink: 'https://g.page/purepathlab/review',
      caseStartNumber: 1,
      registrationPrefix: 'PPL',
      dateFormat: 'YYYYMMDD',
      barcodeFormat: 'CODE39',
      disclaimer: 'Report must be clinically correlated. Please discuss with your doctor.',
      invoiceFooter: 'Thank you for choosing Pure Path Lab.'
    });
    console.log('Seeded lab profile.');

    // ---- Signatures (SVG scribbles written to uploads) ----
    const uploadBase = path.resolve(__dirname, '../../', UPLOAD_DIR);
    const sigDir = path.join(uploadBase, 'signatures');
    if (!fs.existsSync(sigDir)) fs.mkdirSync(sigDir, { recursive: true });
    const sigSvg = (seedName, color) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="120" viewBox="0 0 340 120">` +
      `<rect width="340" height="120" fill="#ffffff"/>` +
      `<path d="M20,78 C45,20 60,95 95,55 S140,85 175,45 S240,80 320,40" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>` +
      `<text x="20" y="108" font-family="cursive" font-size="20" fill="${color}">${seedName}</text></svg>`;
    fs.writeFileSync(path.join(sigDir, 'seed-sign-anjali.svg'), sigSvg('A. Rao', '#1e3a8a'));
    fs.writeFileSync(path.join(sigDir, 'seed-sign-vikram.svg'), sigSvg('V. Malhotra', '#7c2d12'));
    const signatures = await Signature.create([
      { name: 'Dr. Anjali Rao', title: 'Consultant Pathologist', imageUrl: 'uploads/signatures/seed-sign-anjali.svg', modalities: ['LAB'], status: 'Active', createdBy: adminUser._id },
      { name: 'Dr. Vikram Malhotra', title: 'Consultant Radiologist', imageUrl: 'uploads/signatures/seed-sign-vikram.svg', modalities: ['USG', 'XRAY'], status: 'Active', createdBy: adminUser._id }
    ]);
    console.log(`Seeded ${signatures.length} signatures.`);
    const sigLab = signatures[0];

    // ---- Patients: 12 curated + 48 generated = 60 ----
    const firstM = ['Arjun', 'Karan', 'Rahul', 'Suresh', 'Deepak', 'Manoj', 'Vikas', 'Nitin', 'Ashok', 'Harish', 'Dinesh', 'Ramesh', 'Mahesh', 'Prakash', 'Sunil', 'Ravi', 'Ajay', 'Sanjeev', 'Pankaj', 'Vinod', 'Rakesh', 'Satish', 'Yogesh', 'Anil'];
    const firstF = ['Neha', 'Ritu', 'Shalini', 'Divya', 'Rekha', 'Seema', 'Anita', 'Geeta', 'Nisha', 'Poonam', 'Rina', 'Shobha', 'Alka', 'Meena', 'Kiran', 'Vandana', 'Suman', 'Usha', 'Kamla', 'Asha', 'Babita', 'Sarita', 'Mamta', 'Ruchi'];
    const lasts = ['Sharma', 'Gupta', 'Khan', 'Patel', 'Reddy', 'Das', 'Yadav', 'Mishra', 'Tiwari', 'Agrawal', 'Kapoor', 'Malhotra', 'Khanna', 'Bose', 'Chatterjee', 'Pillai', 'Rao', 'Kulkarni', 'Saxena', 'Joshi', 'Pandey', 'Dubey', 'Negi', 'Rawat'];
    const areas = ['Dwarka, Delhi', 'Rohini, Delhi', 'Laxmi Nagar, Delhi', 'Mayur Vihar, Delhi', 'Uttam Nagar, Delhi', 'Shahdara, Delhi', 'Munirka, Delhi', 'Vivek Vihar, Delhi', 'Palam, Delhi', 'Saket, Delhi', 'Karol Bagh, Delhi', 'Preet Vihar, Delhi'];
    const genPatients = [];
    for (let i = 0; i < 48; i += 1) {
      const female = i % 2 === 1;
      const fn = female ? firstF[(i / 2) | 0] : firstM[i / 2];
      const ln = lasts[i % lasts.length];
      genPatients.push({
        name: `${fn} ${ln}`,
        age: 5 + ((i * 37) % 70),
        gender: female ? 'Female' : 'Male',
        phone: `98${String(10000000 + i * 7919).slice(0, 8)}`,
        ...(i % 3 === 0 ? { uhid: `UHID-${2000 + i}` } : {}),
        address: `${10 + i}, ${areas[i % areas.length]}`
      });
    }
    const allPatientInputs = [...seedData.patients, ...genPatients];
    const baseJoin = [0, 0, 1, 2, 3, 5, 8, 12, 20, 35, 60, 100];
    const patientsData = allPatientInputs.map((p, idx) => {
      const joined = atDay(idx < baseJoin.length ? baseJoin[idx] : 160 + (idx % 40), 9, 30);
      return {
        ...p,
        registrationNumber: `PPL-${compact(joined)}-${String(idx + 1).padStart(4, '0')}`,
        referringDoctor: doctors[idx % doctors.length]._id,
        date: joined
      };
    });
    const patients = await Patient.create(patientsData);
    console.log(`Seeded ${patients.length} patients.`);

    // ---- Bills: ~150 across 6 months + items + transactions ----
    const priceOf = (it) => (it.t ? testByCode[it.t].price : pkgByName[it.p].price);
    const nameOf = (it) => (it.t ? testByCode[it.t].name : pkgByName[it.p].name);
    const idOf = (it) => (it.t ? testByCode[it.t]._id : pkgByName[it.p]._id);
    const typeOf = (it) => (it.t ? 'Test' : 'TestPackage');
    const methods = ['Cash', 'UPI', 'Card', 'Insurance'];
    const N_BILLS = 150;
    const bills = [];
    let billSeq = 1;
    for (let i = 0; i < N_BILLS; i += 1) {
      // Quadratic spread: dense recent days, sparse tail to ~180 days (trends).
      const daysAgo = Math.round(180 * ((i / (N_BILLS - 1)) ** 2));
      const d = atDay(daysAgo, 10 + (i % 8), 15);
      const dept = i % 10 < 6 ? 'LAB' : (i % 10 < 8 ? 'USG' : 'XRAY');
      const items = [];
      const nItems = 1 + (i % 3 === 0 ? 1 : 0) + (i % 7 === 0 ? 1 : 0);
      for (let j = 0; j < nItems; j += 1) {
        if ((i + j) % 9 === 0) items.push({ p: pkgNames[(i + j) % pkgNames.length] });
        else items.push({ t: testCodes[(i * 5 + j * 3) % testCodes.length] });
      }
      const gross = items.reduce((s, it) => s + priceOf(it), 0);
      const discount = i % 4 === 0 ? 50 : 0;
      const total = Math.max(0, gross - discount);
      const paid = i % 5 === 0 ? 0 : (i % 3 === 0 ? Math.round(total * 0.6) : total);
      const due = Math.max(0, total - paid);
      const status = due === 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Pending');
      const bill = new Bill({
        billNumber: `INV-${compact(d)}-${String(billSeq).padStart(5, '0')}`,
        patient: patients[i % patients.length]._id,
        referringDoctor: doctors[i % doctors.length]._id,
        agent: i % 2 === 0 ? agents[i % agents.length]._id : null,
        discount,
        totalAmount: total,
        paidAmount: paid,
        dueAmount: due,
        paymentMethod: methods[i % methods.length],
        paymentStatus: status,
        department: dept,
        caseType: dept === 'USG' ? 'UsgCase' : (dept === 'XRAY' ? 'DigitalXrayCase' : 'LabCase'),
        collectionCentre: 'Main',
        uhid: patients[i % patients.length].uhid || '',
        dailyCaseNo: `DCN-${compact(d)}-${String(billSeq).padStart(3, '0')}`,
        date: d,
        createdBy: adminUser._id
      });
      billSeq += 1;
      await bill.save();
      const created = await BillItem.create(items.map((it) => ({
        billId: bill._id, itemType: typeOf(it), itemId: idOf(it), name: nameOf(it), price: priceOf(it)
      })));
      bill.items = created.map((c) => c._id);
      await bill.save();
      bills.push(bill);
      if (paid > 0) {
        await Transaction.create({
          patient: bill.patient,
          bill: bill._id,
          amount: paid,
          paymentMethod: bill.paymentMethod,
          type: 'Income',
          receivedBy: (i % 3 === 0 ? staffUser : adminUser)._id,
          date: d
        });
      }
    }
    // A few partial refunds against older paid bills.
    for (const [bIdx, amt, ago] of [[8, 100, 10], [20, 120, 18], [40, 80, 30]]) {
      await Transaction.create({
        patient: bills[bIdx].patient,
        bill: bills[bIdx]._id,
        amount: amt,
        paymentMethod: 'Cash',
        type: 'Refund',
        receivedBy: adminUser._id,
        date: atDay(ago, 12, 0)
      });
    }
    console.log(`Seeded ${bills.length} bills + transactions.`);

    // ---- Lab reports: ~80 across the workflow ----
    const MID = { HB: 14, TLC: 7500, DLC: 55, ESR: 10, BS_R: 100, S_BIL_T: 0.8, B_UREA: 28, S_CREAT: 0.9, TSH: 2.5, SGOT: 20, SGPT: 22, CHOL: 170, HDL: 55, HBA1C: 5.2 };
    const r2 = (n) => Math.round(n * 100) / 100;
    const mkValue = (code, k) => {
      const mid = MID[code] ?? 10;
      const r = rand();
      if (code === 'URINE') return { value: 'Normal', flag: 'N' };
      if (r < 0.12) return { value: String(r2(mid * 1.4)), flag: 'H' };
      if (r < 0.2) return { value: String(r2(mid * 0.7)), flag: 'L' };
      return { value: String(r2(mid * (0.9 + rand() * 0.2))), flag: 'N' };
    };
    const tatFor = (base, status) => {
      const tat = { registered: base };
      if (['Collected', 'Received', 'Reported', 'Signed', 'Completed'].includes(status)) tat.collected = plusHours(base, 2);
      if (['Received', 'Reported', 'Signed', 'Completed'].includes(status)) tat.received = plusHours(base, 5);
      if (['Reported', 'Signed', 'Completed'].includes(status)) tat.reported = plusHours(base, 8);
      return tat;
    };
    const labBills = bills.filter((b) => b.department === 'LAB');
    const N_REPORTS = Math.min(80, labBills.length);
    const reports = [];
    for (let i = 0; i < N_REPORTS; i += 1) {
      const bill = labBills[i];
      const billItems = await BillItem.find({ billId: bill._id }).lean();
      const testItems = billItems.filter((bi) => bi.itemType === 'Test');
      const repCodes = testItems.length
        ? testItems.slice(0, 3).map((bi) => tests.find((t) => String(t._id) === String(bi.itemId))?.code || 'HB')
        : ['HB'];
      const base = new Date(bill.date);
      base.setHours(9, 0, 0, 0);
      const ageDays = Math.round((Date.now() - base.getTime()) / 86400000);
      let status;
      if (i === 9) status = 'Rejected';
      else if (ageDays > 60) status = i % 2 ? 'Completed' : 'Signed';
      else if (ageDays > 20) status = ['Completed', 'Signed', 'Reported'][i % 3];
      else if (ageDays > 7) status = ['Reported', 'Received', 'Completed'][i % 3];
      else if (ageDays > 2) status = ['Collected', 'Received', 'Reported'][i % 3];
      else status = ['Registered', 'Collected', 'Received', 'Reported'][i % 4];
      const results = repCodes.map((code) => {
        const t = testByCode[code];
        const v = mkValue(code, i);
        return { test: t._id, testName: t.name, value: v.value, unit: t.unit || '', flag: v.flag };
      });
      const signed = ['Signed', 'Completed'].includes(status);
      const pat = patients.find((p) => String(p._id) === String(bill.patient));
      const rep = await Report.create({
        patient: bill.patient,
        registrationNumber: pat.registrationNumber,
        bill: bill._id,
        test: testByCode[repCodes[0]]._id,
        uhid: pat.uhid || '',
        dailyCaseNo: `DCN-${compact(base)}-R${i + 1}`,
        cc: 'Main',
        results,
        tat: tatFor(base, status),
        signatures: signed ? [{ signature: sigLab._id, signedBy: adminUser._id, signedAt: plusHours(base, 9) }] : [],
        reportDate: base,
        uploadedBy: adminUser._id,
        status,
        ...(status === 'Rejected' ? { rejectReason: 'Hemolyzed sample — recollect requested.' } : {})
      });
      reports.push(rep);
    }
    console.log(`Seeded ${reports.length} lab reports.`);

    // ---- USG cases (20) ----
    const usgFindings = {
      abdomen: 'LIVER: Normal size, shape and echotexture. No focal lesion.\nGALLBLADDER: Well distended, no calculus.\nSPLEEN, PANCREAS, KIDNEYS: Normal.\nBLADDER: Normal.\nIMPRESSION: Normal scan of Abdomen & Pelvis.',
      renal: 'RIGHT KIDNEY: 10.2 cm, normal parenchyma, no stone or hydronephrosis.\nLEFT KIDNEY: 10.5 cm, normal.\nBLADDER: Normal.\nIMPRESSION: Normal renal ultrasound.',
      obstetric: 'Single live intrauterine gestation of approx 12 weeks. Fetal cardiac activity present.\nNo subchorionic hemorrhage.\nIMPRESSION: Live intrauterine gestation, 12 weeks.'
    };
    const usgTemplates = ['Abdomen & Pelvis (Normal)', 'Renal Ultrasound (Normal)', 'Obstetric Scan (First Trimester)'];
    const usgTexts = [usgFindings.abdomen, usgFindings.renal, usgFindings.obstetric];
    for (let i = 0; i < 20; i += 1) {
      await USGCase.create({
        patient: patients[(i * 7) % patients.length]._id,
        referringDoctor: doctors[i % doctors.length]._id,
        templateName: usgTemplates[i % usgTemplates.length],
        findings: usgTexts[i % usgTexts.length],
        date: atDay(i % 30, 11, 30),
        status: i % 4 === 0 ? 'Pending' : 'Completed'
      });
    }
    console.log('Seeded 20 USG cases.');

    // ---- X-Ray cases (15) ----
    const xrayTexts = [
      'Chest PA view: lung fields clear, no consolidation. Cardiac shadow normal. No pleural effusion. IMPRESSION: Normal chest radiograph.',
      'Left knee AP/lateral: joint space maintained, no fracture line seen. Soft tissues normal. IMPRESSION: No acute bony injury.',
      'Lumbo-sacral spine AP/lateral: vertebral alignment normal, mild degenerative changes L4-L5. IMPRESSION: Early spondylosis.'
    ];
    for (let i = 0; i < 15; i += 1) {
      await XrayCase.create({
        patient: patients[(i * 11) % patients.length]._id,
        referringDoctor: doctors[i % doctors.length]._id,
        findings: xrayTexts[i % xrayTexts.length],
        date: atDay((i * 2) % 30, 12, 0),
        status: i % 5 === 0 ? 'Pending' : 'Completed'
      });
    }
    console.log('Seeded 15 X-Ray cases.');

    // ---- Booking inquiries (8) ----
    const inqStatuses = ['New', 'New', 'Contacted', 'Confirmed', 'New', 'Contacted', 'Confirmed', 'Cancelled'];
    for (let i = 0; i < 8; i += 1) {
      const usePatient = i % 2 === 0;
      const pat = patients[(i * 13) % patients.length];
      const code = testCodes[(i * 7) % testCodes.length];
      await Inquiry.create({
        patient: usePatient ? pat._id : null,
        name: usePatient ? pat.name : `${pick(firstM.concat(firstF))} ${pick(lasts)}`,
        phone: usePatient ? pat.phone : `98${String(11000000 + i * 9773).slice(0, 8)}`,
        items: [
          { kind: 'Test', refId: testByCode[code]._id, name: `${testByCode[code].name} (${code})`, price: testByCode[code].price },
          ...(i % 3 === 0 ? [{ kind: 'Package', refId: pkgByName['Hemogram (CBC/ESR)']._id, name: 'Hemogram (CBC/ESR)', price: 350 }] : [])
        ],
        preferredDate: i % 2 === 0 ? atDay(-(1 + (i % 5)), 9, 0) : null,
        note: i % 3 === 0 ? 'Morning slot preferred, fasting sample.' : '',
        status: inqStatuses[i],
        source: 'portal',
        createdAt: atDay(i % 10, 8 + (i % 8), 45)
      });
    }
    console.log('Seeded 8 booking inquiries.');

    // ---- Expenses (40 across ~3 months) ----
    const expCats = [
      ['Medical Supplies', 2500, 9000, 'Reagents, tubes and syringes'],
      ['Office Rent', 15000, 15000, 'Lab facility rent'],
      ['Electricity Bill', 2800, 4200, 'Power and cooling charges'],
      ['Courier', 600, 1500, 'Outstation sample dispatch'],
      ['Maintenance', 4000, 12000, 'Equipment AMC installment'],
      ['Calibration', 3000, 4000, 'Analyzer calibration'],
      ['Stationery', 800, 2000, 'Forms and barcode stickers'],
      ['Utilities', 400, 900, 'Drinking water cans'],
      ['Housekeeping', 2000, 3500, 'Deep cleaning service']
    ];
    const expMethods = ['Cash', 'UPI', 'Card'];
    for (let i = 0; i < 40; i += 1) {
      const [cat, lo, hi, desc] = expCats[i % expCats.length];
      const d = atDay((i * 7) % 95, 13, 0);
      await Expense.create({
        spentOn: d,
        name: `${cat} #${(i / expCats.length | 0) + 1}`,
        category: cat,
        amount: lo + Math.floor(rand() * (hi - lo)),
        date: d,
        description: desc,
        paymentMethod: expMethods[i % expMethods.length],
        addedBy: adminUser._id
      });
    }
    console.log('Seeded 40 expenses.');

    // ---- Support tickets / browsers / jobs / activities ----
    await SupportTicket.create([
      ...(seedData.tickets || []).map((t) => ({ ...t, createdBy: adminUser._id })),
      { subject: 'USG printer paper jam on thermal roll', message: 'Label printer ate two label rolls this week. Needs servicing.', status: 'Open', createdBy: staffUser._id },
      { subject: 'Add Lipid Profile to packages', message: 'Patients keep asking for lipid tests inside the full body package.', status: 'InProgress', createdBy: adminUser._id },
      { subject: 'Evening shift roster clash', message: 'Two phlebos assigned the same Shahdara beat on Fridays.', status: 'Resolved', createdBy: staffUser._id },
      { subject: 'WhatsApp template approval pending', message: 'Report-ready template still under review with provider.', status: 'Open', createdBy: adminUser._id }
    ]);
    console.log('Seeded 6 support tickets.');
    await WebBrowser.create((seedData.browsers || []).map((b) => ({ ...b, createdBy: adminUser._id })));
    console.log('Seeded browser allow-list.');

    await Job.create([
      {
        type: 'notify',
        status: 'Failed',
        payload: { channel: 'sms', templateKey: 'report-ready', to: patients[0].phone, vars: { name: patients[0].name, regNo: patients[0].registrationNumber, url: '', lab: 'Pure Path Lab' } },
        error: 'SMS provider timeout (seeded demo failure)',
        attempts: 1,
        createdBy: adminUser._id
      },
      {
        type: 'notify',
        status: 'Failed',
        payload: { channel: 'whatsapp', templateKey: 'report-ready-wa', to: patients[3].phone, vars: { name: patients[3].name, regNo: patients[3].registrationNumber, url: '' } },
        error: 'WhatsApp template not approved (seeded demo failure)',
        attempts: 2,
        createdBy: adminUser._id
      },
      {
        type: 'notify',
        status: 'Done',
        payload: { channel: 'email', templateKey: 'welcome', to: 'demo@example.com', vars: { name: 'Demo', regNo: 'PPL-DEMO-0001', lab: 'Pure Path Lab' } },
        error: '',
        attempts: 1,
        createdBy: adminUser._id
      }
    ]);
    console.log('Seeded demo jobs.');

    const activitySpecs = [
      ['Generated invoice for Aarav Mehta.', 'Cases', 0],
      ['Updated USG findings for Meera Deshmukh.', 'Cases', 0],
      ['Collected payment of INR 499 on invoice (seeded).', 'Cases', 1],
      ['Confirmed booking inquiry for Priya Nair.', 'Cases', 1],
      ['Added signature of Dr. Anjali Rao.', 'Settings', 2],
      ['Updated lab profile settings.', 'Settings', 5],
      ['Created bulk rate revision draft (seeded).', 'Settings', 6],
      ['Voided invoice with reason (seeded demo).', 'Cases', 8],
      ['Exported daily business CSV (seeded).', 'Business', 12],
      ['Reviewed referral payouts for August (seeded).', 'Business', 30],
      ['Blocked browser LAB-PC-02 (seeded demo).', 'Manage', 20],
      ['Registered collection agent Vikram Singh.', 'Manage', 45]
    ];
    for (const [desc, mod, daysAgo] of activitySpecs) {
      await Activity.create({
        user: adminUser._id,
        action: desc.split(' ').slice(0, 3).join(' '),
        module: mod,
        description: desc,
        date: atDay(daysAgo, 15, 30)
      });
    }
    console.log('Seeded activity log.');

    console.log('--- Demo logins: admin@purepathlab.com / admin123 | staff@purepathlab.com / staff123 | doctor@purepathlab.com / doctor123 ---');
    console.log('--- Patient portal: use any seeded patient phone, e.g. 9988776655 (Aarav) or 9811012233 (Priya). OTP prints to backend console in dev. ---');
    console.log('Seeding process completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding Process Error:', error);
    process.exit(1);
  }
};

seedDB();
