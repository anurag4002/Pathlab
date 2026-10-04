import React from 'react';
import { Button, Input, Select } from '../common';
import './AgeReferenceEditor.css';

const units = [{ value: 'd', label: 'Days' }, { value: 'mo', label: 'Months' }, { value: 'y', label: 'Years' }];
const sexes = [{ value: 'Any', label: 'Any' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }];

const AgeReferenceEditor = ({ ranges = [], onChange, error, idPrefix = 'range', disabled = false }) => {
  const update = (index, field, value) => onChange(ranges.map((range, i) => i === index ? { ...range, [field]: value } : range));
  return <fieldset className="age-reference-editor" disabled={disabled}>
    <legend>Age and sex reference ranges</legend>
    <p className="form-helper">The patient's age and sex select the range used for the report and abnormal flags. Add the bands from your lab's existing reference table.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {ranges.map((range, index) => <div className="age-range-row" key={index}>
      <div className="age-reference-grid">
        <Select label="Sex" name={`${idPrefix}-sex-${index}`} value={range.sex || 'Any'} options={sexes} placeholder="" onChange={(e) => update(index, 'sex', e.target.value)} />
        <Input label="From age" name={`${idPrefix}-min-${index}`} type="number" step="any" min="0" value={range.ageMin ?? ''} onChange={(e) => update(index, 'ageMin', e.target.value)} />
        <Select label="From unit" name={`${idPrefix}-min-unit-${index}`} value={range.ageMinUnit || 'y'} options={units} placeholder="" onChange={(e) => update(index, 'ageMinUnit', e.target.value)} />
        <Input label="Through age" name={`${idPrefix}-max-${index}`} type="number" step="any" min="0" value={range.ageMax ?? ''} onChange={(e) => update(index, 'ageMax', e.target.value)} />
        <Select label="Through unit" name={`${idPrefix}-max-unit-${index}`} value={range.ageMaxUnit || 'y'} options={units} placeholder="" onChange={(e) => update(index, 'ageMaxUnit', e.target.value)} />
        <Input label="Reference range" name={`${idPrefix}-text-${index}`} value={range.referenceRange || ''} placeholder="e.g. 12 - 15 or < 200" onChange={(e) => {
          onChange(ranges.map((r, i) => i === index ? { ...r, referenceRange: e.target.value, normalLow: null, normalHigh: null, lowInclusive: null, highInclusive: null } : r));
        }} />
        <Input label="Critical low (optional)" name={`${idPrefix}-critical-low-${index}`} type="number" step="any" value={range.criticalLow ?? ''} onChange={(e) => update(index, 'criticalLow', e.target.value)} />
        <Input label="Critical high (optional)" name={`${idPrefix}-critical-high-${index}`} type="number" step="any" value={range.criticalHigh ?? ''} onChange={(e) => update(index, 'criticalHigh', e.target.value)} />
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={() => onChange(ranges.filter((_, i) => i !== index))}>Remove range {index + 1}</Button>
    </div>)}
    <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...ranges, { sex: 'Any', ageMin: '', ageMinUnit: 'y', ageMax: '', ageMaxUnit: 'y', referenceRange: '' }])}>Add age / sex range</Button>
  </fieldset>;
};
export default AgeReferenceEditor;
