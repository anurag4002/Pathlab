import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useUiVersion } from '../../../utils/uiVersion';
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
  const isV2 = useUiVersion() === 'v2';
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef(null);
  // Latest onSearch, so removing a chip applies after the page re-renders
  // with the new value (handlers read page state from their closure).
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  useEffect(() => {
    if (!panelOpen) return undefined;
    const close = (event) => { if (!panelRef.current?.contains(event.target)) setPanelOpen(false); };
    const esc = (event) => { if (event.key === 'Escape') setPanelOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [panelOpen]);
  const [expanded, setExpanded] = useState(false);
  // On phones a tall stack of filters pushes the list off screen: show the
  // first field and a Filters toggle for the rest.
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches);
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 640px)');
    if (!query) return undefined;
    const update = () => setNarrow(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  const limit = narrow ? 1 : collapseAfter;
  const canCollapse = (showToggle || narrow) && fields.length > limit;
  const visible = canCollapse && !expanded ? fields.slice(0, limit) : fields;

  // New look: the search box applies itself shortly after typing stops (the
  // separate "Search" button is gone; the top-bar search types in here too).
  const searchTimer = useRef(null);
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  const setValue = (key, value) => {
    onChange?.(key, value);
    const field = fields.find((f) => f.key === key);
    const isSearchText = field && (field.type === 'text' || field.type === 'search' || !field.type) && /search/i.test(`${field.key} ${field.label || ''}`);
    if (isV2 && isSearchText) {
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => onSearchRef.current?.(), 400);
    }
  };

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
            data-filter-text=""
            className="form-control"
            placeholder={f.placeholder ?? f.label ?? ''}
            value={value ?? ''}
            onChange={(e) => setValue(f.key, e.target.value)}
          />
        </div>
      </div>
    );
  };

  if (isV2) {
    // New look: tabs and the search box stay on the strip; every other
    // filter lives in a panel behind "Filters (n)", and the ones in use show
    // as removable chips.
    const isInline = (f) => f.type === 'segmented' || ((f.type === 'text' || f.type === 'search' || !f.type) && /search/i.test(`${f.key} ${f.label || ''}`));
    const inline = fields.filter(isInline);
    const inPanel = fields.filter((f) => !isInline(f));
    // "All …" choices and sort order are defaults, not filters: no chip.
    const isSet = (f) => {
      const v = values[f.key];
      if (v === undefined || v === null || v === '' || v === false || /sort/i.test(f.key)) return false;
      const option = (f.options || []).find((o) => String(o.value) === String(v));
      return !(option && /^(all|any)\b/i.test(String(option.label)));
    };
    const display = (f) => {
      const v = values[f.key];
      if (f.type === 'toggle') return '';
      if (f.type === 'date') {
        const d = new Date(`${v}T00:00:00`);
        return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      const option = (f.options || []).find((o) => String(o.value) === String(v));
      return option ? option.label : f.type === 'custom' ? '' : String(v);
    };
    // Unlabelled custom controls (e.g. the reporting month) are settings, not filters.
    const active = inPanel.filter((f) => isSet(f) && !(f.type === 'custom' && !f.label));
    const removeChip = (f) => {
      setValue(f.key, f.type === 'toggle' ? false : '');
      setTimeout(() => onSearchRef.current?.(), 0);
    };
    return (
      <div className={`afb afb--v2 ${className}`.trim()}>
        <div className="afb-v2-row">
          {inline.map(renderField)}
          {inPanel.length > 0 && (
            <div className="afb-v2-filter" ref={panelRef}>
              <Button variant="secondary" size="sm" icon={<SlidersHorizontal size={14} />} onClick={() => setPanelOpen((open) => !open)} aria-expanded={panelOpen}>
                Filters{active.length ? <span className="afb-v2-count">{active.length}</span> : null}
              </Button>
              {panelOpen && (
                <div className="afb-v2-panel" role="dialog" aria-label="Filters">
                  <div className="afb-v2-panel-fields">{inPanel.map(renderField)}</div>
                  <div className="afb-v2-panel-actions">
                    {onClear && <Button variant="secondary" size="sm" onClick={() => { onClear(); setPanelOpen(false); }}>Clear all</Button>}
                    <Button variant="primary" size="sm" onClick={() => { onSearch?.(); setPanelOpen(false); }}>{onSearch ? 'Apply' : 'Done'}</Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {active.map((f) => {
            const text = display(f);
            return (
              <span key={f.key} className="afb-chip">
                <span>{f.label || f.key}{text ? <>: <strong>{text}</strong></> : null}</span>
                <button type="button" aria-label={`Remove filter ${f.label || f.key}`} onClick={() => removeChip(f)}><X size={12} /></button>
              </span>
            );
          })}
          {active.length > 0 && onClear && showClearButton && (
            <button type="button" className="afb-v2-clear" onClick={onClear}><X size={13} /> Clear</button>
          )}
          {inline.some((f) => f.type !== 'segmented') && onSearch && showSearchButton && !inPanel.length && (
            <Button variant="secondary" size="sm" onClick={onSearch}>Search</Button>
          )}
          {(actions || (trailing != null && trailing !== false)) && (
            <div className="afb-v2-end">
              {actions}
              {trailing != null && trailing !== false && <span className="afb-trailing">{trailing}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

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
              {expanded ? (narrow ? 'Fewer filters' : 'Show less') : narrow ? `Filters (${fields.length - limit} more)` : 'Show all filters'}
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
