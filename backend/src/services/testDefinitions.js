// A parameter keeps its parent catalog identity but has a distinct result key
// and formula variable. This lets multi-parameter tests retain separate values.
function expandTests(tests) {
  return tests.flatMap((test) => test.parameters?.length
    ? test.parameters.map((parameter) => ({ ...test, ...parameter, _id: test._id,
      parentName: test.name, name: `${test.name}: ${parameter.name}`, parameterCode: parameter.code,
      referenceRanges: parameter.referenceRanges || [], isDerived: !!parameter.isDerived,
      formula: parameter.formula || '', normalLow: parameter.normalLow ?? null, normalHigh: parameter.normalHigh ?? null,
      criticalLow: parameter.criticalLow ?? null, criticalHigh: parameter.criticalHigh ?? null,
      resultOptions: parameter.resultOptions || [],
      maleReferenceRange: parameter.maleReferenceRange || '', femaleReferenceRange: parameter.femaleReferenceRange || '',
      ageMin: parameter.ageMin ?? null, ageMax: parameter.ageMax ?? null, sexApplicable: parameter.sexApplicable || 'Any' }))
    : [test.sourceFieldName ? { ...test, name: test.sourceFieldName } : test]);
}
const resultKey = (testId, parameterCode) => parameterCode ? `${testId}:${parameterCode}` : String(testId);
const orderTestsBySource = tests => [...tests].sort((a,b)=>(a.displayOrder ?? Infinity)-(b.displayOrder ?? Infinity));
function includeFormulaDependencies(selected, catalog) {
  const { parseFormula } = require('./formulaExpression');
  const byCode = new Map(expandTests(catalog).map((t) => [t.code.toUpperCase(), t]));
  const byId = new Map(catalog.map((t) => [String(t._id), t]));
  const resolved = new Map(selected.map((t) => [String(t._id), t]));
  const queue = [...selected];
  while (queue.length) {
    const parent = queue.shift();
    for (const test of expandTests([parent])) {
      if (!test.isDerived || !test.formula) continue;
      let references;
      try { references = parseFormula(test.formula).references; } catch { continue; }
      for (const ref of references) {
        const definition = byCode.get(ref);
        const input = definition && byId.get(String(definition._id));
        if (!input || resolved.has(String(input._id))) continue;
        resolved.set(String(input._id), { ...input, formulaInput: true });
        queue.push(input);
      }
    }
  }
  return [...resolved.values()];
}
module.exports = { expandTests, resultKey, includeFormulaDependencies, orderTestsBySource };
