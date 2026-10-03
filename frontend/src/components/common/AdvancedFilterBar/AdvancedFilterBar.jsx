import React, { useState } from 'react';
import Button from '../Button/Button';
import Select from '../Select/Select';
import DatePicker from '../DatePicker/DatePicker';
import './AdvancedFilterBar.css';

/**
 * Shared filter bar — one aligned layout for every page.
 *
 * fields: [{
 *   key, label, type: 'text'|'select'|'date'|'toggle'|'segmented'|'custom',
 *   placeholder?, options?, size?: 'sm'|'md'|'lg'|'auto',
 *   render?: ({ value, onChange, values }) => ReactNode
 * }]
 */
export const DURATION_OPTIONS = [
  { value: '', label: 'All time' },
  { value: 'Past 7 days', label: 'Past 7 days' },
  { value: 'Past 30 days', label: 'Past 30 days' },
  { value: 'Past 90 days', label: 'Past 90 days' },
  { value: 'Today', label: 'Today' },
  { value: 'Yesterday', label: 'Yesterday' }
];

const sizeClass = (size) => {
  if (size === 'sm') return 'afb-field--sm';
  if (size === 'lg') return 'afb-field--lg';
  if (size === 'auto') return 'afb-field--auto';
  if (size === 'md') return 'afb-field--md';
  return '';
};

const AdvancedFilterBar = ({
  fields = [],
  values = {},
  onChange,
  onSearch,
  onClear,
  showToggle = true,
  collapseAfter = 6,
  showSearchButton = true,
  showClearButton = true,
  trailing = null,
  actions = null,
  variant = 'card', // 'card' | 'plain'
  className = ''
}) => {
  const [expanded, setExpanded] = useState(false);
  const canCollapse = showToggle && fields.length > collapseAfter;
  const visible = canCollapse && !expanded ? fields.slice(0, collapseAfter) : fields;

  const setValue = (key, value) => onChange?.(key, value);

  const renderField = (f) => {
    const value = values[f.key];
    const fieldClass = `afb-field ${sizeClass(f.size || (f.type === 'toggle' || f.type === 'segmented' || f.type === 'custom' ? 'auto' : 'md'))}`;

    if (f.type === 'custom' && typeof f.render === 'function') {
      return (
        <div key={f.key} className={fieldClass}>
          {f.label ? <div className="form-label"><span>{f.label}</span></div> : null}
          {f.render({ value, onChange: (v) => setValue(f.key, v), values })}
        </div>
      );
    }

    if (f.type === 'segmented') {
      return (
        <div key={f.key} className={fieldClass}>
          {f.label ? <div className="form-label"><span>{f.label}</span></div> : null}
          <div className="afb-segmented" role="tablist" aria-label={f.label || f.key}>
            {(f.options || []).map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                role="tab"
                className={`afb-segmented-btn ${value === opt.value ? 'active' : ''}`}
                aria-selected={value === opt.value}
                onClick={() => setValue(f.key, opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (f.type === 'toggle') {
      return (
        <div key={f.key} className={fieldClass}>
          <div className="form-label" aria-hidden="true">&nbsp;</div>
          <label className="afb-toggle">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => setValue(f.key, e.target.checked)}
            />
            {f.label}
          </label>
        </div>
      );
    }

    if (f.type === 'select') {
      return (
        <div key={f.key} className={fieldClass}>
          <Select
            label={f.label}
            name={f.key}
            value={value ?? ''}
            onChange={(e) => setValue(f.key, e.target.value)}
            options={f.options || []}
            placeholder={f.placeholder ?? (f.label ? `All ${f.label}` : 'All')}
          />
        </div>
      );
    }

    if (f.type === 'date') {
      return (
        <div key={f.key} className={`${fieldClass} afb-field--sm`}>
          <DatePicker
            label={f.label}
            name={f.key}
            value={value ?? ''}
            onChange={(e) => setValue(f.key, e.target.value)}
          />
        </div>
      );
    }

    // text / search default
    return (
      <div key={f.key} className={fieldClass}>
        <div className="form-group">
          {f.label ? (
            <label className="form-label" htmlFor={`afb-${f.key}`}>
              <span>{f.label}</span>
            </label>
          ) : null}
          <input
            id={`afb-${f.key}`}
            type={f.type === 'search' ? 'search' : 'text'}
            className="form-control"
            placeholder={f.placeholder ?? f.label ?? ''}
            value={value ?? ''}
            onChange={(e) => setValue(f.key, e.target.value)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={`afb ${variant === 'plain' ? 'afb-plain' : ''} ${className}`.trim()}>
      <div className="afb-row">
        {visible.map(renderField)}

        <div className="afb-actions">
          {showSearchButton && onSearch && (
            <Button variant="primary" size="sm" onClick={onSearch}>
              Search
            </Button>
          )}
          {showClearButton && onClear && (
            <Button variant="secondary" size="sm" onClick={onClear}>
              Clear
            </Button>
          )}
          {canCollapse && (
            <Button variant="secondary" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : 'Show all filters'}
            </Button>
          )}
          {actions}
          {trailing != null && trailing !== false && (
            <span className="afb-trailing">{trailing}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedFilterBar;
