import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getTests } from '../../../services/testService';

const RECENT_KEY = 'test-combobox-recent';
const DEBOUNCE_MS = 300;

const loadRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveRecent = (test) => {
  try {
    const prev = loadRecent().filter((t) => t._id !== test._id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([{ _id: test._id, code: test.code, name: test.name, price: test.price }, ...prev].slice(0, 5)));
  } catch {
    /* storage unavailable — ignore */
  }
};

const deptOf = (t) => t.category?.name || t.department || 'Uncategorized';

/**
 * Phase 12 — shared debounced test combobox.
 * - Debounce >= 250ms, cancels in-flight requests on each keystroke.
 * - Keyboard nav (Up/Down/Enter/Escape), grouped by department.
 * - Create-new shortcut + recent-tests shortcut (localStorage).
 */
const TestCombobox = ({
  onSelect,
  onCreateNew,
  placeholder = 'Type to search tests (code, name, dept, price)...',
  label = 'Search tests',
  autoFocus = false,
  clearOnSelect = true
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [touched, setTouched] = useState(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const [recent, setRecent] = useState(() => loadRecent());

  const fetchResults = useCallback(async (q) => {
    // Cancel in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await getTests({ search: q });
      if (requestIdRef.current !== reqId || controller.signal.aborted) return;
      if (res.success) setResults(res.data || []);
      setHighlight(0);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err.response?.data?.message || 'Search failed');
      setResults([]);
    } finally {
      if (requestIdRef.current === reqId && !controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!touched) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchResults(query.trim()), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, touched, fetchResults]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const grouped = results.reduce((acc, t) => {
    const d = deptOf(t);
    (acc[d] = acc[d] || []).push(t);
    return acc;
  }, {});
  const flat = results;

  const choose = (test) => {
    saveRecent(test);
    setRecent(loadRecent());
    onSelect?.(test);
    if (clearOnSelect) setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && flat[highlight]) choose(flat[highlight]);
      else if (query.trim()) fetchResults(query.trim());
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showRecent = open && !query.trim();

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      {label && <label className="form-label">{label}</label>}
      <input
        ref={inputRef}
        className="form-control"
        value={query}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setTouched(true); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: '4px',
          backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '300px', overflowY: 'auto'
        }} role="listbox">
          {loading && <div style={{ padding: '10px 12px', fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>Searching…</div>}
          {error && <div style={{ padding: '10px 12px', fontSize: '0.825rem', color: 'var(--color-danger)' }}>{error}</div>}
          {showRecent && (
            <>
              <div style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Recent</div>
              {recent.length === 0 && <div style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>No recent tests</div>}
              {recent.map((t) => (
                <div key={t._id} role="option" aria-selected="false"
                  onClick={() => choose(t)}
                  style={{ padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <strong>{t.code}</strong> — {t.name}
                </div>
              ))}
            </>
          )}
          {!showRecent && !loading && !error && flat.length === 0 && touched && query.trim() && (
            <div style={{ padding: '10px 12px', fontSize: '0.825rem' }}>
              No tests found for “{query}”.
              {onCreateNew && (
                <button type="button" className="btn btn-secondary" style={{ marginLeft: '8px', padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => onCreateNew(query.trim())}>
                  + Create “{query.trim()}”
                </button>
              )}
            </div>
          )}
          {Object.entries(grouped).map(([dept, items]) => (
            <div key={dept}>
              <div style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', backgroundColor: '#f8fafc', position: 'sticky', top: 0 }}>{dept}</div>
              {items.map((t) => {
                const idx = flat.indexOf(t);
                return (
                  <div key={t._id} role="option" aria-selected={idx === highlight}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => choose(t)}
                    style={{
                      padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer',
                      backgroundColor: idx === highlight ? '#eff6ff' : 'transparent',
                      display: 'flex', justifyContent: 'space-between', gap: '8px'
                    }}>
                    <span><strong>{t.code}</strong> — {t.name}</span>
                    <strong style={{ color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>₹{t.price}</strong>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestCombobox;
