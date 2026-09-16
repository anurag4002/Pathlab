// Formula engine — derived lab values (Labsmart FR-FORM parity).
// Pure functions: no DB. derive(values, patient) -> { derived, applied, skipped }.
//
// `values` keys are matched case-insensitively against each rule's aliases,
// so "Hb", "HB", "haemoglobin" all resolve. All numeric parsing is safe
// (non-numeric -> rule skipped, never throws).

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function get(values, aliases) {
  const keys = Object.keys(values || {});
  for (const a of aliases) {
    const hit = keys.find((k) => k.toLowerCase() === a.toLowerCase());
    if (hit) {
      const n = num(values[hit]);
      if (n !== null) return n;
    }
  }
  return null;
}

const HB = ['hb', 'hemoglobin', 'haemoglobin', 'hgb'];
const RBC = ['rbc', 'rbc count', 'total rbc'];
const HCT = ['hct', 'hematocrit', 'haematocrit', 'pcv'];
const WBC = ['wbc', 'tlc', 'total wbc', 'total leukocyte', 'leukocyte'];
const NEUT = ['neutrophils', 'neutrophil', 'neut', 'polymorphs', 'n%'];
const LYMPH = ['lymphocytes', 'lymphocyte', 'lymph', 'l%'];
const PLT = ['platelet', 'platelets', 'plt', 'platelet count'];
const UREA = ['urea', 'blood urea'];
const CREAT = ['creatinine', 'serum creatinine', 's.creatinine'];
const TP = ['total protein', 'protein total', 't.protein'];
const ALB = ['albumin', 'serum albumin', 's.albumin'];
const TC = ['total cholesterol', 'cholesterol', 't.cholesterol'];
const HDL = ['hdl', 'hdl cholesterol'];
const LDL = ['ldl', 'ldl cholesterol'];
const TG = ['triglycerides', 'triglyceride', 'tg'];
const HBA1C = ['hba1c', 'hb a1c', 'glycated hemoglobin'];
const IRON = ['iron', 'serum iron', 's.iron'];
const TIBC = ['tibc', 'total iron binding capacity'];
const CALCIUM = ['calcium', 'serum calcium', 's.calcium'];
const NA = ['sodium', 'serum sodium', 'na+'];
const K = ['potassium', 'serum potassium', 'k+'];
const CL = ['chloride', 'serum chloride', 'cl-'];
const HCO3 = ['bicarbonate', 'hco3', 'co2'];
const GLU = ['glucose fasting', 'fbs', 'fasting glucose', 'glucose'];
const PT = ['pt', 'prothrombin time'];
const MNPT = ['mnpt', 'mean normal pt', 'control pt'];
const ISI = ['isi'];
const UACR_ALB = ['urine albumin', 'microalbumin', 'urine microalbumin'];
const UACR_CR = ['urine creatinine', 'urine creat'];
const UPCR_P = ['urine protein', 'urine protein creatinine protein', 'protein'];
const EOS = ['eosinophils', 'eosinophil', 'eos', 'e%'];

const RULES = [
  { code: 'MCV', name: 'MCV', unit: 'fL', inputs: [...HCT, ...RBC], need: [HCT, RBC], compute: (g) => (g(HCT) * 10) / g(RBC) },
  { code: 'MCH', name: 'MCH', unit: 'pg', inputs: [...HB, ...RBC], need: [HB, RBC], compute: (g) => (g(HB) * 10) / g(RBC) },
  { code: 'MCHC', name: 'MCHC', unit: 'g/dL', inputs: [...HB, ...HCT], need: [HB, HCT], compute: (g) => (g(HB) * 100) / g(HCT) },
  { code: 'NLR', name: 'Neutrophil-Lymphocyte Ratio', unit: 'ratio', inputs: [...NEUT, ...LYMPH], need: [NEUT, LYMPH], compute: (g) => g(NEUT) / g(LYMPH) },
  { code: 'PLR', name: 'Platelet-Lymphocyte Ratio', unit: 'ratio', inputs: [...PLT, ...LYMPH], need: [PLT, LYMPH], compute: (g) => g(PLT) / g(LYMPH) },
  { code: 'ANC', name: 'Absolute Neutrophil Count', unit: '/µL', inputs: [...WBC, ...NEUT], need: [WBC, NEUT], compute: (g) => (g(WBC) * g(NEUT)) / 100 },
  { code: 'ALC', name: 'Absolute Lymphocyte Count', unit: '/µL', inputs: [...WBC, ...LYMPH], need: [WBC, LYMPH], compute: (g) => (g(WBC) * g(LYMPH)) / 100 },
  { code: 'AEC', name: 'Absolute Eosinophil Count', unit: '/µL', inputs: [...WBC, ...EOS], need: [WBC, EOS], compute: (g) => (g(WBC) * g(EOS)) / 100 },
  { code: 'BUN', name: 'Blood Urea Nitrogen', unit: 'mg/dL', inputs: [...UREA], need: [UREA], compute: (g) => g(UREA) / 2.14 },
  { code: 'BUN_CR', name: 'BUN/Creatinine Ratio', unit: 'ratio', inputs: [...UREA, ...CREAT], need: [UREA, CREAT], compute: (g) => g(UREA) / 2.14 / g(CREAT) },
  {
    code: 'EGFR', name: 'eGFR (CKD-EPI 2021)', unit: 'mL/min/1.73m²', inputs: [...CREAT], need: [CREAT],
    compute: (g, p) => {
      const scr = g(CREAT); const age = num(p && p.age); if (age === null) return null;
      const female = String((p && p.gender) || '').toLowerCase().startsWith('f');
      const k = female ? 0.7 : 0.9; const a = female ? -0.241 : -0.302;
      const r = scr / k;
      let v = 142 * Math.pow(Math.min(r, 1), a) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, age);
      if (female) v *= 1.012;
      return v;
    }
  },
  {
    code: 'CRCL', name: 'Creatinine Clearance (Cockcroft-Gault)', unit: 'mL/min',
    inputs: [...CREAT, 'weight', 'body weight'], need: [CREAT, ['weight', 'body weight']],
    compute: (g, p) => {
      const age = num(p && p.age); const wt = g(['weight', 'body weight']);
      if (age === null || wt === null) return null;
      const female = String((p && p.gender) || '').toLowerCase().startsWith('f');
      let v = ((140 - age) * wt) / (72 * g(CREAT));
      if (female) v *= 0.85;
      return v;
    }
  },
  { code: 'GLOB', name: 'Globulin', unit: 'g/dL', inputs: [...TP, ...ALB], need: [TP, ALB], compute: (g) => g(TP) - g(ALB) },
  { code: 'AGR', name: 'A/G Ratio', unit: 'ratio', inputs: [...ALB, ...TP], need: [ALB, TP], compute: (g) => g(ALB) / (g(TP) - g(ALB)) },
  { code: 'VLDL', name: 'VLDL Cholesterol', unit: 'mg/dL', inputs: [...TG], need: [TG], compute: (g) => g(TG) / 5 },
  {
    code: 'LDL_CALC', name: 'LDL (Friedewald)', unit: 'mg/dL', inputs: [...TC, ...HDL, ...TG], need: [TC, HDL, TG],
    compute: (g) => (g(TG) > 400 ? null : g(TC) - g(HDL) - g(TG) / 5)
  },
  { code: 'NON_HDL', name: 'Non-HDL Cholesterol', unit: 'mg/dL', inputs: [...TC, ...HDL], need: [TC, HDL], compute: (g) => g(TC) - g(HDL) },
  { code: 'TC_HDL', name: 'TC/HDL Ratio', unit: 'ratio', inputs: [...TC, ...HDL], need: [TC, HDL], compute: (g) => g(TC) / g(HDL) },
  { code: 'LDL_HDL', name: 'LDL/HDL Ratio', unit: 'ratio', inputs: [...LDL, ...HDL], need: [LDL, HDL], compute: (g) => g(LDL) / g(HDL) },
  { code: 'TG_HDL', name: 'TG/HDL Ratio', unit: 'ratio', inputs: [...TG, ...HDL], need: [TG, HDL], compute: (g) => g(TG) / g(HDL) },
  {
    code: 'INR', name: 'INR', unit: 'ratio', inputs: [...PT, ...MNPT, ...ISI], need: [PT, MNPT, ISI],
    compute: (g) => Math.pow(g(PT) / g(MNPT), g(ISI))
  },
  { code: 'EAG', name: 'eAG', unit: 'mg/dL', inputs: [...HBA1C], need: [HBA1C], compute: (g) => 28.7 * g(HBA1C) - 46.7 },
  { code: 'UIBC', name: 'UIBC', unit: 'µg/dL', inputs: [...TIBC, ...IRON], need: [TIBC, IRON], compute: (g) => g(TIBC) - g(IRON) },
  { code: 'TSAT', name: 'Transferrin Saturation', unit: '%', inputs: [...IRON, ...TIBC], need: [IRON, TIBC], compute: (g) => (g(IRON) / g(TIBC)) * 100 },
  {
    code: 'CA_CORR', name: 'Corrected Calcium', unit: 'mg/dL', inputs: [...CALCIUM, ...ALB], need: [CALCIUM, ALB],
    compute: (g) => g(CALCIUM) + 0.8 * (4.0 - g(ALB))
  },
  {
    code: 'AGAP', name: 'Anion Gap', unit: 'mEq/L', inputs: [...NA, ...CL, ...HCO3], need: [NA, CL, HCO3],
    compute: (g) => g(NA) - (g(CL) + g(HCO3))
  },
  {
    code: 'OSMO', name: 'Serum Osmolality (calc)', unit: 'mOsm/kg',
    inputs: [...NA, ...GLU, ...UREA], need: [NA, GLU, UREA],
    compute: (g) => 2 * g(NA) + g(GLU) / 18 + g(UREA) / 2.8
  },
  {
    code: 'ACR', name: 'Albumin-Creatinine Ratio', unit: 'mg/g',
    inputs: [...UACR_ALB, ...UACR_CR], need: [UACR_ALB, UACR_CR], compute: (g) => g(UACR_ALB) / g(UACR_CR)
  },
  {
    code: 'PCR', name: 'Protein-Creatinine Ratio', unit: 'mg/mg',
    inputs: [...UPCR_P, ...UACR_CR], need: [UPCR_P, UACR_CR], compute: (g) => g(UPCR_P) / g(UACR_CR)
  },
  {
    code: 'HOMA_IR', name: 'HOMA-IR', unit: 'index',
    inputs: ['fasting insulin', 'insulin fasting', ...GLU], need: [['fasting insulin', 'insulin fasting'], GLU],
    compute: (g) => (g(['fasting insulin', 'insulin fasting']) * g(GLU)) / 405
  },
  {
    code: 'BMI', name: 'BMI', unit: 'kg/m²',
    inputs: ['weight', 'body weight', 'height', 'height cm'], need: [['weight', 'body weight'], ['height', 'height cm']],
    compute: (g) => {
      const h = g(['height', 'height cm']) / 100;
      return g(['weight', 'body weight']) / (h * h);
    }
  }
];

function round2(n) {
  return Math.round(n * 100) / 100;
}

// values: { 'Hb': 13.5, ... }  patient: { age, gender }
function derive(values, patient) {
  const derived = [];
  const applied = [];
  const skipped = [];
  const have = new Set(Object.keys(values || {}).map((k) => k.toLowerCase()));

  for (const rule of RULES) {
    // Skip if the derived test was entered directly.
    if (have.has(rule.code.toLowerCase()) || have.has(rule.name.toLowerCase())) continue;
    const getter = (aliases) => get(values, Array.isArray(aliases) ? aliases : [aliases]);
    const ready = rule.need.every((n) => getter(n) !== null);
    if (!ready) {
      skipped.push({ code: rule.code, reason: 'missing-inputs' });
      continue;
    }
    let value = null;
    try {
      value = rule.compute(getter, patient || {});
    } catch (e) {
      value = null;
    }
    if (value === null || !Number.isFinite(value)) {
      skipped.push({ code: rule.code, reason: 'not-computable' });
      continue;
    }
    applied.push(rule.code);
    derived.push({ testCode: rule.code, testName: rule.name, value: round2(value), unit: rule.unit, derived: true });
  }
  return { derived, applied, skipped };
}

// Abnormal checker + age/sex template restriction.
// test: { normalLow, normalHigh, criticalLow, criticalHigh, ageMin, ageMax, sexApplicable }
// Returns { flag: N|L|H|C|'', critical, outOfRange, restricted, restrictionReason }
function evaluateResult(rawValue, test, patient) {
  const v = num(rawValue);
  const out = { flag: '', critical: false, outOfRange: false, restricted: false, restrictionReason: '' };
  if (v === null) return out;
  const age = num(patient && patient.age);
  const gender = String((patient && patient.gender) || '').toLowerCase();
  if (test) {
    if (test.ageMin !== null && test.ageMin !== undefined && age !== null && age < test.ageMin) {
      out.restricted = true;
      out.restrictionReason = `Not applicable below age ${test.ageMin}`;
    }
    if (test.ageMax !== null && test.ageMax !== undefined && age !== null && age > test.ageMax) {
      out.restricted = true;
      out.restrictionReason = `Not applicable above age ${test.ageMax}`;
    }
    if (test.sexApplicable && test.sexApplicable !== 'Any') {
      const need = test.sexApplicable.toLowerCase();
      if ((need === 'male' && !gender.startsWith('m')) || (need === 'female' && !gender.startsWith('f'))) {
        out.restricted = true;
        out.restrictionReason = `Applicable for ${test.sexApplicable} only`;
      }
    }
    if (test.criticalLow !== null && test.criticalLow !== undefined && v <= test.criticalLow) {
      out.flag = 'C'; out.critical = true; out.outOfRange = true; return out;
    }
    if (test.criticalHigh !== null && test.criticalHigh !== undefined && v >= test.criticalHigh) {
      out.flag = 'C'; out.critical = true; out.outOfRange = true; return out;
    }
    if (test.normalLow !== null && test.normalLow !== undefined && v < test.normalLow) {
      out.flag = 'L'; out.outOfRange = true; return out;
    }
    if (test.normalHigh !== null && test.normalHigh !== undefined && v > test.normalHigh) {
      out.flag = 'H'; out.outOfRange = true; return out;
    }
  }
  out.flag = 'N';
  return out;
}

module.exports = { RULES, derive, evaluateResult, _num: num };
