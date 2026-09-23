import React, { useMemo, useState, useEffect } from 'react';
import { Input } from '../../../components/common';
import { Hash, CalendarDays, ListOrdered } from 'lucide-react';

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
      setSavedNote('Prefix and format saved in this browser. The start number saves to the server.');
    } catch (e) {
      setSavedNote('Could not save locally.');
    }
  };

  return (
    <section className="lab-profile-card" aria-label="Registration number format">
      <div className="lab-profile-card-header">
        <span className="lab-profile-icon-box"><Hash size={18} /></span>
        <div>
          <h2 className="lab-profile-card-title">Registration Number Format</h2>
          <p className="lab-profile-card-desc">
            Only the start number is saved centrally. Prefix and date format are kept on this device.
            Old numbers stay searchable either way.
          </p>
        </div>
      </div>
      <div className="lab-profile-grid">
        <Input
          label="Prefix"
          value={prefix}
          onChange={(e) => { setPrefix(e.target.value.toUpperCase().slice(0, 8)); setSavedNote(''); }}
          error={!prefixValid ? 'Uppercase alphanumeric, 1–8 chars.' : undefined}
          placeholder="PPL"
          helperText="A–Z, 0–9, no spaces"
        />
        <div className="form-group">
          <label className="form-label" htmlFor="reg-date-format">
            <span>Date segment</span>
          </label>
          <div className="form-control-wrapper">
            <select
              id="reg-date-format"
              className="form-control"
              value={dateFormat}
              onChange={(e) => { setDateFormat(e.target.value); setSavedNote(''); }}
            >
              <option value="YYYYMMDD">YYYYMMDD (e.g. 20260923)</option>
              <option value="YYMMDD">YYMMDD (e.g. 260923)</option>
            </select>
          </div>
        </div>
        <Input
          label="Start number"
          type="number"
          value={startNumber ?? 1}
          min={1}
          onChange={(e) => onStartNumberChange(Number(e.target.value))}
          helperText="Saved to server"
        />
      </div>
      <div className="lab-profile-preview-bar">
        <div>
          <div className="lab-profile-preview-label">Next-number preview</div>
          <div style={{ marginTop: 4 }}>
            <span className="lab-profile-preview-code">{preview}</span>
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={persistLocal}>
          Save prefix/format locally
        </button>
      </div>
      {savedNote && <p className="lab-profile-note success" role="status">{savedNote}</p>}
      <p className="lab-profile-note" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <CalendarDays size={13} /> Date segment uses today&apos;s date. <ListOrdered size={13} /> Sequence is zero-padded to 5 digits.
      </p>
    </section>
  );
};

export default RegNumberConfig;
