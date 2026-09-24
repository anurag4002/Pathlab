import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, User } from 'lucide-react';
import { getPatients } from '../../../services/patientService';
import './PatientPicker.css';
import './PatientPicker.css';

const DEBOUNCE_MS = 350;
const RECENT_LIMIT = 8;

const asList = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.patients)) return d.patients;
  return [];
};

/**
 * PatientPicker — searchable patient selector used everywhere a patient
 * profile is chosen (billing, USG/X-ray/modality cases, report upload).
 * - Empty query shows recently registered patients (server returns newest first).
 * - Typing searches name / phone / reg no server-side (debounced).
 * - Keyboard nav (Up/Down/Enter/Escape), loading + error states.
 */
const PatientPicker = ({
  value = null, // selected patient object or null
  onSelect,
  label = 'Patient',
  placeholder = 'Search name, phone or reg no…',
  error,
  required = false,
  disabled = false,
  id
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [touched, setTouched] = useState(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);
  const boxRef = useRef(null);

  const fetchResults = useCallback(async (q) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setFetchError('');
    try {
      const params = q ? { search: q, limit: 10 } : { limit: RECENT_LIMIT };
      const res = await getPatients(params);
      if (requestIdRef.current !== reqId || controller.signal.aborted) return;
      if (res?.success) setResults(asList(res));
      else setResults([]);
      setHighlight(0);
    } catch (err) {
      if (controller.signal.aborted) return;
      // apiClient doesn't take AbortSignal; treat failures as fetch errors.
      setFetchError(err.response?.data?.message || 'Search failed');
      setResults([]);
    } finally {
      if (requestIdRef.current === reqId && !controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!touched) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
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

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    if (!touched) {
      setTouched(true);
      fetchResults('');
    } else if (results.length === 0 && !loading) {
      fetchResults(query.trim());
    }
  };

  const choose = (patient) => {
    onSelect?.(patient);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && results[highlight]) choose(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showingRecent = !query.trim();

  return (
    <div className="form-group" style={{ marginBottom: 0 }} ref={boxRef}>
      {label && (
        <label className="form-label" htmlFor={id}>
          <span>{label}</span>
          {required && <span className="form-required-star" aria-hidden="true">*</span>}
        </label>
      )}
      {value ? (
        <div className="patient-picker-selected">
          <span className="patient-picker-avatar" aria-hidden="true">
            <User size={15} />
          </span>
          <span className="patient-picker-selected-text">
            <strong>{value.name}</strong>
            <small>{value.registrationNumber || value.phone || ''}</small>
          </span>
          {!disabled && (
            <button
              type="button"
              className="patient-picker-clear"
              onClick={() => { onSelect?.(null); setQuery(''); setTouched(false); setResults([]); }}
              aria-label="Clear selected patient"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div className="form-control-wrapper">
            <Search size={15} className="patient-picker-search-icon" aria-hidden="true" />
            <input
              id={id}
              type="text"
              className={`form-control patient-picker-input ${error ? 'has-error' : ''}`}
              value={query}
              disabled={disabled}
              placeholder={placeholder}
              onChange={(e) => { setQuery(e.target.value); setTouched(true); setOpen(true); }}
              onFocus={openList}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              autoComplete="off"
            />
          </div>
          {open && (
            <div className="patient-picker-dropdown" role="listbox">
              <div className="patient-picker-group-title">
                {loading ? 'Searching…' : showingRecent ? 'Recently registered' : `${results.length} match${results.length === 1 ? '' : 'es'}`}
              </div>
              {fetchError && <div className="patient-picker-error">{fetchError}</div>}
              {!loading && !fetchError && results.length === 0 && touched && (
                <div className="patient-picker-empty">No patients found{query.trim() ? ` for “${query.trim()}”` : ''}.</div>
              )}
              {results.map((p, i) => (
                <div
                  key={p._id}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(p)}
                  className={`patient-picker-option${i === highlight ? ' highlighted' : ''}`}
                >
                  <span className="patient-picker-option-main">
                    <strong>{p.name}</strong>
                    <small>{p.registrationNumber || 'No reg no'}</small>
                  </span>
                  <span className="patient-picker-option-sub">{p.phone || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

export default PatientPicker;
