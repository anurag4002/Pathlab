import { parseFormula, evaluateFormula } from '../../../backend/src/services/formulaRuntime.cjs';

const entryKey = (test) => test.resultKey || test.testId || `name:${test.testName || ''}`;

// Compile only when the report's definitions change, rather than while typing.
export function compileReportFormulas(testEntries = []) {
  return testEntries.filter((test) => test.isDerived).map((test) => {
    try {
      return { test, parsed: parseFormula(test.formula) };
    } catch (error) {
      return { test, error: test.formula ? error.message : 'Formula not configured' };
    }
  });
}

// Entirely local and synchronous. Rebuild from measured values on every edit
// so removed/invalid inputs cannot leave stale values in a dependency chain.
export function calculateLocalResults(testEntries = [], compiled = [], values = {}, patient = {}) {
  const inputs = {};
  for (const test of testEntries) {
    if (test.isDerived) continue;
    const value = values[entryKey(test)];
    if (test.testCode) inputs[test.testCode] = value;
    if (test.testName) inputs[test.testName] = value;
  }
  const calculated = {}, errors = {};
  const pending = new Map();
  for (const item of compiled) {
    if (item.error) errors[entryKey(item.test)] = item.error;
    else pending.set(item.test, item.parsed);
  }
  while (pending.size) {
    let progress = false;
    for (const [test, formula] of pending) {
      try {
        const evaluated = evaluateFormula(formula, inputs, patient);
        const value = typeof evaluated === 'number' ? Math.round(evaluated * 1e10) / 1e10 : evaluated;
        if (test.testCode) inputs[test.testCode] = value;
        if (test.testName) inputs[test.testName] = value;
        calculated[entryKey(test)] = { value: String(value), unit: test.unit || '' };
        pending.delete(test);
        progress = true;
      } catch { /* Retry after resolving formula dependencies. */ }
    }
    if (!progress) break;
  }
  for (const [test, formula] of pending) {
    try { evaluateFormula(formula, inputs, patient); }
    catch (error) { errors[entryKey(test)] = error.message; }
  }
  return { calculated, errors };
}
