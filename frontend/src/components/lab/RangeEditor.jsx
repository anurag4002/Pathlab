import React from 'react';
import { Input, Select } from '../common';

/**
 * Phase 2 — numeric normal/critical range editor with age/sex applicability.
 * Controlled component: `value` holds the numeric fields, `onChange(patch)` merges.
 */
const RangeEditor = ({ value = {}, onChange, errors = {} }) => {
  const set = (field) => (e) => onChange({ [field]: e.target.value });

  return (
    <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
      <legend style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0 6px' }}>Numeric Normal Ranges</legend>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <Input label="Normal Low" name="normalLow" type="number" step="any"
            value={value.normalLow ?? ''} onChange={set('normalLow')} error={errors.normalLow} placeholder="e.g. 12.0" />
        </div>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <Input label="Normal High" name="normalHigh" type="number" step="any"
            value={value.normalHigh ?? ''} onChange={set('normalHigh')} error={errors.normalHigh} placeholder="e.g. 16.0" />
        </div>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <Input label="Critical Low" name="criticalLow" type="number" step="any"
            value={value.criticalLow ?? ''} onChange={set('criticalLow')} error={errors.criticalLow} placeholder="e.g. 7.0" />
        </div>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <Input label="Critical High" name="criticalHigh" type="number" step="any"
            value={value.criticalHigh ?? ''} onChange={set('criticalHigh')} error={errors.criticalHigh} placeholder="e.g. 20.0" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <Input label="Age Min (yrs)" name="ageMin" type="number" min="0"
            value={value.ageMin ?? ''} onChange={set('ageMin')} error={errors.ageMin} placeholder="e.g. 18" />
        </div>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <Input label="Age Max (yrs)" name="ageMax" type="number" min="0"
            value={value.ageMax ?? ''} onChange={set('ageMax')} error={errors.ageMax} placeholder="e.g. 65" />
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <Select label="Sex Applicable" name="sexApplicable"
            value={value.sexApplicable || 'Any'} onChange={set('sexApplicable')}
            options={[
              { value: 'Any', label: 'Any' },
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' }
            ]}
            error={errors.sexApplicable} />
        </div>
      </div>
    </fieldset>
  );
};

/** Client-side range validation (mirrors backend validator). Returns errors object. */
export const validateRanges = (v = {}) => {
  const errs = {};
  const num = (x) => (x === undefined || x === null || x === '' ? null : Number(x));
  const low = num(v.normalLow); const high = num(v.normalHigh);
  const cLow = num(v.criticalLow); const cHigh = num(v.criticalHigh);
  const aMin = num(v.ageMin); const aMax = num(v.ageMax);
  for (const [k, val] of [['normalLow', low], ['normalHigh', high], ['criticalLow', cLow], ['criticalHigh', cHigh], ['ageMin', aMin], ['ageMax', aMax]]) {
    if (val !== null && isNaN(val)) errs[k] = `${k} must be a number`;
  }
  if (low !== null && high !== null && !isNaN(low) && !isNaN(high) && low > high) errs.normalHigh = 'normalHigh must be >= normalLow';
  if (cLow !== null && low !== null && !isNaN(cLow) && !isNaN(low) && cLow > low) errs.criticalLow = 'criticalLow must be <= normalLow';
  if (cHigh !== null && high !== null && !isNaN(cHigh) && !isNaN(high) && cHigh < high) errs.criticalHigh = 'criticalHigh must be >= normalHigh';
  if (aMin !== null && !isNaN(aMin) && aMin < 0) errs.ageMin = 'ageMin must be >= 0';
  if (aMax !== null && !isNaN(aMax) && aMax < 0) errs.ageMax = 'ageMax must be >= 0';
  if (aMin !== null && aMax !== null && !isNaN(aMin) && !isNaN(aMax) && aMin > aMax) errs.ageMax = 'ageMax must be >= ageMin';
  if (v.sexApplicable && !['Any', 'Male', 'Female'].includes(v.sexApplicable)) errs.sexApplicable = 'Must be Any, Male or Female';
  return errs;
};

/** Parse '' → null, numeric strings → Number for API payloads. */
export const normalizeRangePayload = (v = {}) => {
  const out = {};
  for (const k of ['normalLow', 'normalHigh', 'criticalLow', 'criticalHigh', 'ageMin', 'ageMax']) {
    out[k] = (v[k] === undefined || v[k] === null || v[k] === '') ? null : Number(v[k]);
  }
  out.sexApplicable = v.sexApplicable || 'Any';
  return out;
};

export default RangeEditor;
