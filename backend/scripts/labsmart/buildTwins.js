#!/usr/bin/env node
// Auto-map scraped Labsmart report PDFs to Pathlab reports by patient name / reg.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../../src/config/environment');

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Report = require('../../src/models/Report');
const Patient = require('../../src/models/Patient');

const REPORTS_DIR = path.resolve(__dirname, '../../tests/fixtures/labsmart/reports');

function stripTitle(name) {
  return String(name || '')
    .replace(/^(Miss\.|Mrs\.|Mr\.|Master\.|Baby\.|Ms\.)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function norm(name) {
  return stripTitle(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function main() {
  const metas = fs.readdirSync(REPORTS_DIR)
    .filter(name => name.endsWith('.meta.json'))
    .map(name => JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, name), 'utf8')))
    .filter(meta => meta.id && !meta.error);

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    const patients = await Patient.find({}, { name: 1, registrationNumber: 1 }).lean();
    const reports = await Report.find({}, {
      registrationNumber: 1, patient: 1, results: 1, createdAt: 1
    }).populate('patient', 'name registrationNumber').lean();

    const byPatientId = new Map();
    for (const report of reports) {
      const pid = String(report.patient?._id || report.patient || '');
      if (!pid) continue;
      if (!byPatientId.has(pid)) byPatientId.set(pid, []);
      byPatientId.get(pid).push(report);
    }

    const twins = [];
    let matched = 0;
    for (const meta of metas) {
      const target = norm(meta.patient);
      let patientHit = null;
      if (target) {
        patientHit = patients.find(p => norm(p.name) === target)
          || patients.find(p => norm(p.name).includes(target) || target.includes(norm(p.name)));
      }

      let reportHit = null;
      if (patientHit) {
        const list = (byPatientId.get(String(patientHit._id)) || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        reportHit = list[0] || null;
      }
      if (!reportHit && meta.reg) {
        reportHit = reports.find(r => String(r.registrationNumber || '').endsWith(String(meta.reg)))
          || reports.find(r => String(r.registrationNumber || '').includes(String(meta.reg)));
      }

      const twin = {
        labsmartId: String(meta.id),
        slug: meta.slug || String(meta.id),
        labsmartPatient: meta.patient || '',
        labsmartReg: meta.reg || '',
        pathlabRegistration: reportHit?.registrationNumber || null,
        pathlabReportId: reportHit?._id ? String(reportHit._id) : null,
        pathlabPatient: reportHit?.patient?.name || patientHit?.name || null,
        resultCount: reportHit?.results?.length || 0
      };
      if (twin.pathlabRegistration) matched += 1;
      twins.push(twin);
    }

    twins.sort((a, b) => Number(b.labsmartId) - Number(a.labsmartId));
    const out = path.join(REPORTS_DIR, 'twins.json');
    fs.writeFileSync(out, JSON.stringify(twins, null, 2));
    console.log(`mapped ${matched}/${twins.length} Labsmart PDFs to Pathlab reports -> ${out}`);
    const missing = twins.filter(t => !t.pathlabRegistration).slice(0, 15);
    if (missing.length) {
      console.log('unmapped sample:');
      for (const item of missing) console.log(' ', item.labsmartId, item.labsmartPatient, 'reg', item.labsmartReg);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
