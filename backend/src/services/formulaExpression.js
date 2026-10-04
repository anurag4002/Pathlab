const { parseFormula, evaluateFormula } = require('./formulaRuntime.cjs');

function validateFormula(test, catalog) {
  const { expandTests } = require('./testDefinitions');
  catalog = expandTests(catalog.filter((t) => !test._id || String(t._id) !== String(test._id)));
  const targets = expandTests([test]);
  if (!targets.some((t) => t.isDerived)) return '';
  try {
    const byCode = new Map(catalog.map((t) => [String(t.code).toUpperCase(), t]));
    targets.forEach((t) => byCode.set(String(t.code).toUpperCase(), t));
    const visited = new Set(), visiting = new Set();
    function walk(current) {
      const key = String(current.code).toUpperCase();
      if (visiting.has(key)) throw new Error('Formula contains a circular test dependency');
      if (visited.has(key) || !current.isDerived) return;
      visiting.add(key);
      for (const ref of parseFormula(current.formula).references) {
        const input = byCode.get(ref);
        if (!input) throw new Error(`Unknown input test code: ${ref}`);
        walk(input);
      }
      visiting.delete(key);
      visited.add(key);
    }
    targets.forEach(walk);
    return '';
  } catch (error) { return error.message; }
}

module.exports = { parseFormula, evaluateFormula, validateFormula };
