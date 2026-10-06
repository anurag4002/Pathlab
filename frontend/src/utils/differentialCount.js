const CELL_TYPES = ['neutrophils', 'lymphocytes', 'eosinophils', 'monocytes', 'basophils'];
const ALIASES = {
  neutrophils: ['neut', 'neu', 'n%'], lymphocytes: ['lymph', 'lym', 'l%'],
  eosinophils: ['eos', 'e%'], monocytes: ['mono', 'mon', 'm%'], basophils: ['baso', 'bas', 'b%']
};

export const differentialEntryKey = entry => entry.resultKey || entry.testId || `name:${entry.testName || ''}`;

function cellType(entry) {
  const name = [entry.testName, entry.parentName].filter(Boolean).join(' ');
  const unit = String(entry.unit || entry.existingUnit || '').trim();
  // Absolute counts and ratios are separate measurements, never percentages.
  if (/absolute|\bratio\b/i.test(name) || (unit && !/%|percent/i.test(unit))) return null;
  const candidates = [entry.testName?.split(':').pop(), entry.parameterCode, entry.testCode].filter(Boolean);
  for (const candidate of candidates) {
    const normalized = String(candidate).toLowerCase().replace(/_/g, ' ').trim();
    for (const type of CELL_TYPES) {
      if (new RegExp(`\\b${type.replace(/s$/, '')}s?\\b`).test(normalized) || ALIASES[type].includes(normalized)) return type;
    }
  }
  return null;
}

// Place a total immediately after the last of the five differential rows.
// One shared calculation keeps the popup and full-page entry identical.
export function differentialTotalsByRow(entries, values, calculated = {}) {
  const groups = new Map();
  (entries || []).forEach((entry, index) => {
    if (entry.legacyScalar) return;
    const type = cellType(entry);
    if (!type) return;
    const groupKey = entry.parameterCode && entry.testId
      ? `test:${entry.testId}`
      : entry.panelName || entry.packageName || entry.categoryName || 'differential';
    if (!groups.has(groupKey)) groups.set(groupKey, new Map());
    const group = groups.get(groupKey);
    if (!group.has(type)) group.set(type, { entry, index });
  });
  const totals = new Map();
  for (const group of groups.values()) {
    if (CELL_TYPES.some(type => !group.has(type))) continue;
    let total = 0, entered = 0, invalid = false, last = null;
    for (const { entry, index } of group.values()) {
      const key = differentialEntryKey(entry);
      const raw = String(entry.isDerived ? calculated[key]?.value ?? '' : values[key] ?? '').trim();
      if (raw !== '') {
        const numeric = Number(raw.replace(/%$/, '').replace(/,/g, '').trim());
        entered++;
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) invalid = true;
        else total += numeric;
      }
      if (!last || index > last.index) last = { key, index };
    }
    total = Math.round(total * 1e6) / 1e6;
    const complete = entered === CELL_TYPES.length;
    totals.set(last.key, {
      value: invalid || !entered ? '—' : String(total),
      status: invalid || (complete && Math.abs(total - 100) > 1e-6) ? 'warning' : complete ? 'complete' : 'pending',
      message: invalid ? 'Enter a percentage between 0 and 100 for each cell type.'
        : !complete ? `${entered} of 5 entered · Expected total: 100%`
          : Math.abs(total - 100) > 1e-6 ? 'Differential percentages should total 100%.' : 'Differential percentages total 100%.'
    });
  }
  return totals;
}
