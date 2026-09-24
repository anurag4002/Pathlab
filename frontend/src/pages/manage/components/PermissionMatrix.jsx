import React from 'react';
import { PERMISSION_KEYS } from '../../../hooks/usePermission';

// Permission matrix editor. Works with an OBJECT map { key: true } and
// converts legacy arrays on the way in.
export const permsToMap = (perms) => {
  if (!perms) return {};
  if (Array.isArray(perms)) {
    const m = {};
    perms.forEach((k) => { m[k] = true; });
    return m;
  }
  if (typeof perms.get === 'function') {
    const m = {};
    try {
      Array.from(perms.keys()).forEach((k) => { m[k] = perms.get(k); });
    } catch (e) { /* ignore */ }
    return m;
  }
  return { ...perms };
};

const PERM_META = {
  billing: 'Create bills and collect payments',
  reports: 'Lab results entry, verification and printing',
  rates: 'Revise test catalog rates',
  finance: 'Expenses, dues and business ledgers',
  settings: 'Lab configuration, TAT and signatures',
  patients: 'Patient registry and case history',
  delivery: 'Messages, templates and notifications'
};

const PermissionMatrix = ({ value, onChange, disabledReason }) => {
  const map = permsToMap(value);
  const toggle = (k) => {
    const next = { ...map };
    if (next[k]) delete next[k];
    else next[k] = true;
    onChange(next);
  };
  const setAll = (on) => {
    if (on) {
      const next = {};
      PERMISSION_KEYS.forEach((k) => { next[k] = true; });
      onChange(next);
    } else {
      onChange({});
    }
  };

  return (
    <div>
      <div className="perm-matrix-head" style={{ marginBottom: '12px' }}>
        <label className="form-label" style={{ margin: 0 }}><span>Permissions</span></label>
        <div className="perm-matrix-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll(true)}>All</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll(false)}>None</button>
        </div>
      </div>
      {disabledReason && <p className="emp-form-hint" style={{ marginBottom: '12px' }}>{disabledReason}</p>}
      <div className="perm-grid">
        {PERMISSION_KEYS.map((k) => (
          <label key={k} className={`perm-card ${map[k] ? 'on' : ''}`}>
            <input type="checkbox" checked={!!map[k]} onChange={() => toggle(k)} />
            <span>
              <span className="perm-card-title">{k}</span>
              <span className="perm-card-desc" style={{ display: 'block' }}>{PERM_META[k] || ''}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default PermissionMatrix;
