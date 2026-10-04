const HB = { key: 'HB', label: 'Hemoglobin input (g/dL)', aliases: ['HB', 'HGB'], names: ['hemoglobin', 'haemoglobin'] };
const HCT = { key: 'HCT', label: 'Hematocrit input (%)', aliases: ['HCT', 'PCV'], names: ['hematocrit', 'haematocrit'] };
const RBC = { key: 'RBC', label: 'RBC input (million/cumm)', aliases: ['RBC'], names: ['rbc count', 'rbc'] };

export const FORMULA_TEMPLATES = [
  { code: 'MCV', label: 'MCV — Hematocrit × 10 / RBC', inputs: [HCT, RBC], expression: 'ROUND(([HCT] * 10) / [RBC], 1)' },
  { code: 'MCH', label: 'MCH — Hemoglobin × 10 / RBC', inputs: [HB, RBC], expression: 'ROUND(([HB] * 10) / [RBC], 1)' },
  { code: 'MCHC', label: 'MCHC — Hemoglobin × 100 / Hematocrit', inputs: [HB, HCT], expression: 'ROUND(([HB] * 100) / [HCT], 1)' }
];

export const buildTemplateFormula = (template, inputs) => template.expression.replace(/\[([^\]]+)\]/g, (_, key) => `[${inputs[key] || key}]`);

export const formulaReferences = (formula) => [...new Set(
  (String(formula || '').match(/\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_]*/g) || [])
    .filter((token) => !['ROUND', 'MIN', 'MAX', 'ABS', 'POW', 'INR', 'FRIEDEWALD_LDL', 'CKD_EPI_2021', 'GFR_CATEGORY'].includes(token.toUpperCase()))
    .map((token) => token.replace(/^\[|\]$/g, '').trim().toUpperCase())
)];
