// Restricted arithmetic parser. Stored formulas never execute JavaScript.
function parseFormula(source) {
  const text = String(source || '').trim();
  if (!text || text.length > 1000) throw new Error('Enter a formula of at most 1,000 characters');
  const tokens = text.match(/\[[^\[\]\r\n]+\]|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|\*\*|[+*/^(),-]|\S/g) || [];
  let pos = 0;
  const references = new Set();
  const take = (token) => tokens[pos] === token && (++pos, true);
  const expect = (token) => { if (!take(token)) throw new Error(`Expected "${token}" in formula`); };
  const functions = { ROUND: [1, 2], ABS: [1, 1], MIN: [1, 20], MAX: [1, 20], POW: [2, 2], INR: [3, 3], FRIEDEWALD_LDL: [3, 3], CKD_EPI_2021: [1, 1], GFR_CATEGORY: [1, 1] };
  function primary() {
    const token = tokens[pos++];
    if (token === '(') { const node = sum(); expect(')'); return node; }
    if (/^(?:\d|\.\d)/.test(token || '')) return { number: Number(token) };
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token || '') && take('(')) {
      const name = token.toUpperCase();
      if (!functions[name]) throw new Error(`Unsupported function: ${token}`);
      const args = [sum()];
      while (take(',')) args.push(sum());
      expect(')');
      const [min, max] = functions[name];
      if (args.length < min || args.length > max) throw new Error(`Invalid arguments for ${name}`);
      return { name, args };
    }
    if (/^\[[^\[\]]+\]$/.test(token || '') || /^[A-Za-z_][A-Za-z0-9_]*$/.test(token || '')) {
      const ref = token.startsWith('[') ? token.slice(1, -1).trim() : token;
      if (!ref) throw new Error('Empty test code in formula');
      references.add(ref.toUpperCase());
      return { ref };
    }
    throw new Error(`Unexpected ${token ? `"${token}"` : 'end of formula'}`);
  }
  function power() {
    const left = primary();
    if (take('^') || take('**')) return { op: '^', left, right: unary() };
    return left;
  }
  function unary() {
    if (take('+')) return unary();
    if (take('-')) return { op: '-', left: { number: 0 }, right: unary() };
    return power();
  }
  function product() {
    let left = unary();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++];
      left = { op, left, right: unary() };
    }
    return left;
  }
  function sum() {
    let left = product();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++];
      left = { op, left, right: product() };
    }
    return left;
  }
  const tree = sum();
  if (pos !== tokens.length) throw new Error(`Unexpected "${tokens[pos]}" in formula`);
  return { tree, references: [...references] };
}

function evaluateFormula(parsed, values, patient = {}) {
  const byCode = new Map(Object.entries(values || {}).map(([k, v]) => [k.toUpperCase(), v]));
  function visit(node) {
    let value;
    if ('number' in node) value = node.number;
    else if (node.ref) {
      const raw = byCode.get(node.ref.toUpperCase());
      if (raw == null || String(raw).trim() === '') throw new Error(`Missing input: ${node.ref}`);
      value = Number(String(raw).replace(/,/g, '').trim());
    } else if (node.args) {
      const args = node.args.map(visit);
      if (node.name === 'ABS') value = Math.abs(args[0]);
      if (node.name === 'MIN') value = Math.min(...args);
      if (node.name === 'MAX') value = Math.max(...args);
      if (node.name === 'POW') value = Math.pow(args[0], args[1]);
      if (node.name === 'INR') {
        if (args.some((n) => n <= 0)) throw new Error('PT, control PT and reagent ISI must be greater than zero');
        value = Math.pow(args[0] / args[1], args[2]);
      }
      if (node.name === 'FRIEDEWALD_LDL') {
        if (args[2] >= 400 || args.some((n) => n < 0)) throw new Error('Friedewald LDL requires triglycerides below 400 mg/dL and non-negative lipid values');
        value = args[0] - args[1] - args[2] / 5;
        if (value < 0) throw new Error('Calculated LDL is negative; check input values');
      }
      if (node.name === 'CKD_EPI_2021') {
        const scales = { days: 1 / 365.25, months: 1 / 12, years: 1 };
        const age = patient.age == null ? NaN : Number(patient.age) * (scales[patient.ageUnit] || 1);
        if (!Number.isFinite(age) || age < 18) throw new Error('CKD-EPI 2021 requires an adult age (18 years or older)');
        if (!['Male', 'Female'].includes(patient.gender)) throw new Error('CKD-EPI 2021 requires the sex used by the equation');
        if (args[0] <= 0) throw new Error('Creatinine must be greater than zero');
        const female = patient.gender === 'Female', k = female ? 0.7 : 0.9, a = female ? -0.241 : -0.302;
        value = 142 * Math.min(args[0] / k, 1) ** a * Math.max(args[0] / k, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
      }
      if (node.name === 'GFR_CATEGORY') {
        if (args[0] < 0) throw new Error('eGFR must be non-negative');
        return args[0] >= 90 ? 'G1' : args[0] >= 60 ? 'G2' : args[0] >= 45 ? 'G3a' : args[0] >= 30 ? 'G3b' : args[0] >= 15 ? 'G4' : 'G5';
      }
      if (node.name === 'ROUND') {
        const places = args[1] ?? 0;
        if (!Number.isInteger(places) || places < 0 || places > 10) throw new Error('ROUND precision must be 0 to 10');
        value = Math.round(args[0] * 10 ** places) / 10 ** places;
      }
    } else {
      const a = visit(node.left), b = visit(node.right);
      if (node.op === '+') value = a + b;
      if (node.op === '-') value = a - b;
      if (node.op === '*') value = a * b;
      if (node.op === '/') { if (b === 0) throw new Error('Cannot divide by zero'); value = a / b; }
      if (node.op === '^') value = Math.pow(a, b);
    }
    if (!Number.isFinite(value)) throw new Error('Formula inputs must produce a finite number');
    return value;
  }
  return visit(parsed.tree);
}

module.exports = { parseFormula, evaluateFormula };
