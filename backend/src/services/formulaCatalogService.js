const { parseBounds } = require('./referenceRangeService');
const { getResultOptions } = require('./resultOptionsService');

const SINGLE_FORMULAS = {
  MCV: ['ROUND([HCT] * 10 / [TOTAL_RBC_COUNT], 1)', 'fL'],
  MCH: ['ROUND([HB] * 10 / [TOTAL_RBC_COUNT], 1)', 'Pg'],
  MCHC: ['ROUND([HB] * 100 / [HCT], 1)', 'g/dl'],
  AEC: ['ROUND([TLC] * [DLC_EOSINOPHILS] / 100, 0)', 'cumm'],
  NLR: ['ROUND([DLC_NEUTROPHILS] / [DLC_LYMPHOCYTE], 2)', ''],
  BUN: ['ROUND([SERUM_UREA] / 2.14, 2)', 'mg/dl'],
  BUN_CREATININE_RATIO: ['ROUND([BUN] / [SERUM_CREATININE], 2)', ''],
  UREA_CREATININE_RATI: ['ROUND([SERUM_UREA] / [SERUM_CREATININE], 2)', ''],
  GLOBULIN: ['ROUND([SERUM_PROTEIN] - [SERUM_ALBUMIN], 2)', 'g/dl'],
  A_G_RATIO: ['ROUND([SERUM_ALBUMIN] / ([SERUM_PROTEIN] - [SERUM_ALBUMIN]), 2)', ''],
  SERUM_BILIRUBIN_INDI: ['ROUND([SERUM_BILIRUBIN_TOTA] - [SERUM_BILIRUBIN_DIRE], 2)', 'mg/dl'],
  VLDL_CHOLESTEROL: ['ROUND([TRIGLYCERIDES] / 5, 2)', 'mg/dl'],
  LDL_CHOLESTEROL: ['ROUND(FRIEDEWALD_LDL([TOTAL_CHOLESTEROL], [HDL_CHOLESTEROL], [TRIGLYCERIDES]), 2)', 'mg/dl'],
  NON_HDL_CHOLESTEROL: ['ROUND([TOTAL_CHOLESTEROL] - [HDL_CHOLESTEROL], 2)', 'mg/dl'],
  TOTAL_CHOLESTEROL_HD: ['ROUND([TOTAL_CHOLESTEROL] / [HDL_CHOLESTEROL], 2)', ''],
  LDL_HDL: ['ROUND([LDL_CHOLESTEROL] / [HDL_CHOLESTEROL], 2)', ''],
  TG_HDL: ['ROUND([TRIGLYCERIDES] / [HDL_CHOLESTEROL], 2)', ''],
  UIBC: ['ROUND([TOTAL_IRON_BINDING_C] - [IRON], 2)', 'μg/dl'],
  TRANSFERRIN_SATURATI: ['ROUND([IRON] * 100 / [TOTAL_IRON_BINDING_C], 2)', '%'],
  SGOT_SGPT: ['ROUND([SGOT] / [SGPT], 2)', ''],
  EGFR: ['ROUND(CKD_EPI_2021([SERUM_CREATININE]), 2)', 'ml/min/1.73m^2'],
  EGFR_CATEGORY: ['GFR_CATEGORY([EGFR])', '']
};

function parametersFromRange(test) {
  if (test.description !== 'Multi parameter' && !['URINE_ROUTINE_EXAMIN', 'STOOL_ROUTINE_EXAMIN', 'SEMEN_EXAMINATION'].includes(test.code)) return [];
  const parameters = [];
  for (const line of String(test.referenceRange || '').split(/\r?\n/)) {
    const match = line.match(/^(.+?)\s*\(([^()]*)\):\s*(.*)$/)
      || (['URINE_ROUTINE_EXAMIN', 'STOOL_ROUTINE_EXAMIN', 'SEMEN_EXAMINATION'].includes(test.code) && (() => {
        const plain = line.match(/^([^:]+):\s*(.*)$/);
        return plain && [plain[0], plain[1], '', plain[2]];
      })());
    if (match) {
      const code = `${test.code}_${match[1].trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/_$/, '')}`;
      parameters.push({ code, name: match[1].trim(), unit: match[2].trim(), referenceRange: match[3].trim(),
        ...(parseBounds(match[3]) || {}), isDerived: false, formula: '' });
    } else if (parameters.length) {
      parameters[parameters.length - 1].referenceRange += `\n${line}`;
    }
  }
  return parameters;
}

function catalogSetupPlan(catalog) {
  const plan = catalog.map((test) => ({ ...test, parameters: test.parameters?.length ? test.parameters.map((p) => ({ ...p })) : parametersFromRange(test) }));
  const param = (parent, name) => plan.find((t) => t.code === parent)?.parameters.find((p) => p.name === name);
  const apply = (parent, name, formula, unit) => {
    const p = param(parent, name);
    if (p && !p.formula) { p.formula = formula; p.isDerived = true; if (unit) p.unit = unit; }
  };
  const hba1c = param('HBA1C_GLYCOSYLATED_H', 'HbA1c');
  if (hba1c) apply('HBA1C_GLYCOSYLATED_H', 'Estimated average glucose', `ROUND(28.7 * [${hba1c.code}] - 46.7, 2)`);
  const microalbumin = param('MICROALBUMIN_CREATIN', 'Microalbuminuria');
  const urineCreatinine = param('MICROALBUMIN_CREATIN', 'Urinary creatinine');
  if (microalbumin && urineCreatinine) apply('MICROALBUMIN_CREATIN', 'Urinary Albumin Creatinine Ratio (UACR)',
    `ROUND([${microalbumin.code}] * 100 / [${urineCreatinine.code}], 2)`);
  for (const [name, input] of [['Neutrophils', 'NEUTROPHILS'], ['Lymphocytes', 'LYMPHOCYTE'], ['Eosinophils', 'EOSINOPHILS'], ['Monocytes', 'MONOCYTES'], ['Basophils', 'BASOPHILS']]) {
    apply('DIFFERENTIAL_LEUKOCY', name, `ROUND([TLC] * [DLC_${input}] / 100000, 3)`);
  }
  const pt = plan.find((t) => t.code === 'PT_INR');
  if (pt && !pt.parameters.some((p) => p.formula)) {
    pt.parameters.push({ code: 'PT_INR_CONTROL_PT', name: 'Control PT (MNPT)', unit: 'seconds', referenceRange: '', isDerived: false, formula: '' },
      { code: 'PT_INR_ISI', name: 'Reagent ISI', unit: '', referenceRange: '', isDerived: false, formula: '' });
    apply('PT_INR', 'INR Value', 'ROUND(INR([PT_INR_PATIENT_VALUE], [PT_INR_CONTROL_PT], [PT_INR_ISI]), 2)', 'ratio');
  }
  for (const test of plan) {
    test.resultOptions = getResultOptions(test);
    test.parameters.forEach((parameter) => { parameter.resultOptions = getResultOptions(parameter); });
    if (!test.formula && SINGLE_FORMULAS[test.code]) {
      const [formula, unit] = SINGLE_FORMULAS[test.code];
      test.isDerived = true;
      test.formula = formula;
      if (!test.unit) test.unit = unit;
    }
  }
  return plan;
}

module.exports = { SINGLE_FORMULAS, parametersFromRange, catalogSetupPlan };
