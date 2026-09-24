import React, { useState } from 'react';
import Button from '../Button/Button';
import Select from '../Select/Select';
import DatePicker from '../DatePicker/DatePicker';

/**
 * Reusable Labsmart-parity filter bar (§9 §11 §16).
 * Props:
 * - fields: [{ key, label, type: 'text'|'select'|'date'|'toggle', placeholder, options }]
 * - values: object, onChange(key, value)
 * - onSearch, onClear
 * - showToggle defaults true (Show all filters)
 */
export const DURATION_OPTIONS = [
  { value: '', label: 'All time' },
  { value: 'Past 7 days', label: 'Past 7 days' },
  { value: 'Past 30 days', label: 'Past 30 days' },
  { value: 'Past 90 days', label: 'Past 90 days' },
  { value: 'Today', label: 'Today' },
  { value: 'Yesterday', label: 'Yesterday' },
];

const AdvancedFilterBar = ({ fields = [], values = {}, onChange, onSearch, onClear, showToggle = true }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = showToggle && fields.length > 4 ? (expanded ? fields : fields.slice(0, 4)) : fields;

  return (
    <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {visible.map((f) => (
          <div key={f.key} style={{ minWidth: f.type === 'toggle' ? 'auto' : '170px', flex: '0 1 auto' }}>
            {f.type === 'select' ? (
              <Select label={f.label} name={f.key} value={values[f.key] ?? ''} onChange={(e) => onChange?.(f.key, e.target.value)} options={f.options || []} placeholder={f.placeholder || `All ${f.label}`} style={{ marginBottom: 0 }} />
            ) : f.type === 'date' ? (
              <DatePicker label={f.label} value={values[f.key] ?? ''} onChange={(e) => onChange?.(f.key, e.target.value)} style={{ marginBottom: 0 }} />
            ) : f.type === 'toggle' ? (
              <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.85rem', fontWeight: 600, padding: '8px 0' }}>
                <input type="checkbox" checked={!!values[f.key]} onChange={(e) => onChange?.(f.key, e.target.checked)} />
                {f.label}
              </label>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><span>{f.label}</span></label>
                <input className="form-control" placeholder={f.placeholder || f.label} value={values[f.key] ?? ''} onChange={(e) => onChange?.(f.key, e.target.value)} />
              </div>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', paddingBottom: '2px' }}>
          <Button variant="primary" size="sm" onClick={onSearch}>Search</Button>
          <Button variant="secondary" size="sm" onClick={onClear}>Clear</Button>
          {showToggle && fields.length > 4 && (
            <Button variant="secondary" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : 'Show all filters'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedFilterBar;
