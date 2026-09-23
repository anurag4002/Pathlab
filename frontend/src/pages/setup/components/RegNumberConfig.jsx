import React, { useMemo, useState, useEffect } from 'react';
import { Input } from '../../../components/common';

// Phase 23 — registration-number configuration with live preview.
// Backend gap: POST/PUT /api/setup/lab-profile accepts ONLY caseStartNumber;
// prefix + date-format are persisted to localStorage until the backend
// supports them. Changing the prefix never rewrites history: both old and
// new numbers remain searchable (server matches by substring).
const LS_KEY = 'ppl_reg_number_config';

const loadLocal = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const RegNumberConfig = ({ startNumber, onStartNumberChange }) => {
  const [prefix, setPrefix] = useState('PPL');
  const [dateFormat, setDateFormat] = useState('YYYYMMDD');
  const [savedNote, setSavedNote] = useState('');

  useEffect(() => {
    const local = loadLocal();
    if (local.prefix) setPrefix(local.prefix);
    if (local.dateFormat) setDateFormat(local.dateFormat);
  }, []);

  const preview = useMemo(() => {
    const clean = String(prefix || 'PPL').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PPL';
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const datePart = dateFormat === 'YYMMDD'
      ? `${String(now.getFullYear()).slice(2)}${p(now.getMonth() + 1)}${p(now.getDate())}`
      : `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
    const seq = String(Math.max(1, Number(startNumber) || 1)).padStart(5, '0');
    return `${clean}-${datePart}-${seq}`;
  }, [prefix, dateFormat, startNumber]);

  const prefixValid = /^[A-Z0-9]{1,8}$/.test(String(prefix || '').toUpperCase());

  const persistLocal = () => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ prefix: prefix.toUpperCase(), dateFormat }));
      setSavedNote('Prefix/format saved locally (backend accepts only the start number — server gap documented).');
    } catch (e) {
      setSavedNote('Could not save locally.');
    }
  };

  return (
    <div className="card" style={{ padding: '1rem', marginTop: '1rem' }}>
      <h4 style={{ fontWeight: 700, marginBottom: '4px' }}>Registration Number Format</h4>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Backend currently persists only the start number. Prefix and date format are kept in this browser
        until the server accepts <code>registrationPrefix</code>/<code>dateFormat</code>. Historical numbers stay
        searchable either way.
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Input
          label="Prefix (A–Z, 0–9, no spaces)"
          value={prefix}
          onChange={(e) => { setPrefix(e.target.value.toUpperCase().slice(0, 8)); setSavedNote(''); }}
          error={!prefixValid ? 'Uppercase alphanumeric, 1–8 chars.' : undefined}
          style={{ minWidth: '180px', flex: 1 }}
        />
        <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
          <label className="form-label">Date segment</label>
          <select className="form-control" value={dateFormat} onChange={(e) => { setDateFormat(e.target.value); setSavedNote(''); }}>
            <option value="YYYYMMDD">YYYYMMDD (e.g. 20260923)</option>
            <option value="YYMMDD">YYMMDD (e.g. 260923)</option>
          </select>
        </div>
        <Input
          label="Start number (saved to server)"
          type="number"
          value={startNumber ?? 1}
          onChange={(e) => onStartNumberChange(Number(e.target.value))}
          style={{ minWidth: '160px', flex: 1 }}
        />
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
        <span style={{ fontSize: '0.85rem' }}>Next-number preview: <code style={{ fontWeight: 700 }}>{preview}</code></span>
        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={persistLocal}>
          Save prefix/format locally
        </button>
      </div>
      {savedNote && <p style={{ fontSize: '0.78rem', color: 'var(--color-success)' }}>{savedNote}</p>}
    </div>
  );
};

export default RegNumberConfig;
