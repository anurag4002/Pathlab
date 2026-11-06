import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import './SearchSelect.css';

/**
 * A dropdown you can type into: click or focus to see the list, type to
 * narrow it (name or phone), Up/Down + Enter to pick, Esc to close.
 * options: [{ value, label, hint? }]; '' is the empty choice (emptyLabel).
 */
const SearchSelect = ({ id, value, onChange, options = [], emptyLabel = 'None', placeholder = 'Type to search...', ariaLabel }) => {
  const autoId = useId();
  const inputId = id || `ss-${autoId}`;
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const selected = options.find((o) => String(o.value) === String(value));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [{ value: '', label: emptyLabel, isEmpty: true }, ...options];
    if (!q) return list;
    return list.filter((o) => !o.isEmpty && `${o.label} ${o.hint || ''}`.toLowerCase().includes(q));
  }, [options, query, emptyLabel]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) { setOpen(false); setQuery(''); } };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const pick = (option) => {
    onChange?.(option ? option.value : '');
    setOpen(false); setQuery('');
  };
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + shown.length) % Math.max(1, shown.length));
    } else if (event.key === 'Enter') {
      if (!open) return;
      event.preventDefault(); event.stopPropagation();
      if (shown[active]) pick(shown[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation();
      setOpen(false); setQuery('');
    } else if (event.key === 'Tab') {
      setOpen(false); setQuery('');
    }
  };

  return (
    <div className={`search-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <input
        ref={inputRef}
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        className="form-control search-select-input"
        value={open ? query : (selected?.label || '')}
        placeholder={open ? placeholder : emptyLabel}
        onFocus={() => { setOpen(true); setActive(0); }}
        onClick={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {selected && !open ? (
        <button type="button" className="search-select-clear" aria-label={`Clear ${ariaLabel || 'choice'}`} onClick={() => pick(null)}><X size={14} /></button>
      ) : (
        <ChevronDown size={16} className="search-select-chevron" aria-hidden="true" />
      )}
      {open && (
        <ul className="search-select-list" id={listId} role="listbox">
          {shown.length === 0 && <li className="search-select-none">No match for "{query}"</li>}
          {shown.map((option, index) => (
            <li
              key={`${option.value}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={String(option.value) === String(value ?? '')}
              className={`search-select-option${index === active ? ' is-active' : ''}${option.isEmpty ? ' is-empty' : ''}`}
              onPointerDown={(event) => { event.preventDefault(); pick(option); }}
              onMouseEnter={() => setActive(index)}
            >
              <span>{option.label}</span>
              {option.hint && <small>{option.hint}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchSelect;
