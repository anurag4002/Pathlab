import React, { useEffect, useRef, useState } from 'react';
import { Select } from '../common';
import { FORMULA_TEMPLATES, buildTemplateFormula, formulaReferences } from '../../utils/testFormulas';
import { getFormulaTemplates } from '../../services/testService';

const DerivedTestEditor = ({ isDerived = false, formula = '', tests = [], onChange, error = '' }) => {
  const [template, setTemplate] = useState('');
  const [inputs, setInputs] = useState({});
  const [templates, setTemplates] = useState(FORMULA_TEMPLATES);
  const inputRef = useRef(null);
  const references = formulaReferences(formula);
  const selected = templates.find((t) => t.code === template);
  useEffect(() => {
    let active = true;
    getFormulaTemplates().then((response) => {
      if (active && response.data?.length) setTemplates(response.data);
    }).catch(() => { /* keep the basic CBC templates available */ });
    return () => { active = false; };
  }, []);

  const chooseTemplate = (code) => {
    setTemplate(code);
    const preset = templates.find((t) => t.code === code);
    if (!preset) return;
    const next = {};
    preset.inputs.forEach((input) => {
      const test = tests.find((t) => input.aliases.includes(t.code.toUpperCase()))
        || tests.find((t) => input.names.some((name) => t.name.toLowerCase().includes(name)));
      next[input.key] = test?.code || '';
    });
    setInputs(next);
    onChange({ formula: buildTemplateFormula(preset, next) });
  };

  const insertCode = (code) => {
    const element = inputRef.current;
    const start = element?.selectionStart ?? formula.length;
    const end = element?.selectionEnd ?? start;
    const token = `[${code}]`;
    onChange({ formula: formula.slice(0, start) + token + formula.slice(end) });
    setTemplate('');
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <fieldset className="formula-editor">
      <legend>Automatic calculation</legend>
      <label className="formula-toggle">
        <input type="checkbox" checked={!!isDerived} onChange={(e) => onChange({ isDerived: e.target.checked })} />
        <span>This is a calculated test (fx)</span>
      </label>
      {isDerived && <>
        <Select label="Formula template" name="formulaTemplate" value={template}
          placeholder="Custom formula / choose a template"
          options={templates.map((t) => ({ value: t.code, label: t.label }))}
          onChange={(e) => chooseTemplate(e.target.value)} />
        {selected && <div className="test-form-grid">
          {selected.inputs.map((input) => <Select key={input.key}
            name={`formula-input-${input.key}`} label={input.label} value={inputs[input.key] || ''}
            options={tests.map((t) => ({ value: t.code, label: `${t.code} — ${t.name}` }))}
            onChange={(e) => {
              const next = { ...inputs, [input.key]: e.target.value };
              setInputs(next);
              onChange({ formula: buildTemplateFormula(selected, next) });
            }} />)}
        </div>}
        <div className="form-group">
          <label className="form-label" htmlFor="formula">Formula</label>
          <input ref={inputRef} id="formula" name="formula" className={`form-control ${error ? 'has-error' : ''}`}
            value={formula} onChange={(e) => { setTemplate(''); onChange({ formula: e.target.value }); }}
            aria-invalid={!!error} aria-describedby={error ? 'formula-error' : 'formula-help'}
            placeholder="e.g. ROUND(([HCT] * 10) / [RBC], 1)" />
          {error ? <p className="form-error" id="formula-error">{error}</p>
            : <p className="form-helper" id="formula-help">Use test codes, + − * / ^ and parentheses. ROUND, MIN, MAX, ABS and POW are supported. Calculates automatically during result entry and on save.</p>}
        </div>
        <p className="form-helper">Click an input test to insert its code at the cursor.</p>
        <div className="formula-test-list">
          {tests.map((t) => <button key={t._id} type="button" className="formula-test-button"
            onClick={() => insertCode(t.code)} title={`Insert ${t.code}`}>
            {t.code} — {t.name}
          </button>)}
        </div>
        <p className="form-helper" aria-live="polite">Inputs in this formula: {references.length ? references.join(', ') : 'None selected'}</p>
      </>}
    </fieldset>
  );
};

export default DerivedTestEditor;
