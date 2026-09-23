import React from 'react';
import { PERMISSION_KEYS } from '../../../hooks/usePermission';

// Phase 25 — permission matrix editor.
// Backend stores User.permissions as a Map of Boolean; the old UI sent an
// Array of keys (shape mismatch). This component works with an OBJECT map
// { key: true } and converts legacy arrays on the way in.
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label className="form-label" style={{ margin: 0 }}><span>Permissions (object map sent to server)</span></label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: '0.75rem' }} onClick={() => setAll(true)}>All</button>
          <button type="button" className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: '0.75rem' }} onClick={() => setAll(false)}>None</button>
        </div>
      </div>
      {disabledReason && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{disabledReason}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
        {PERMISSION_KEYS.map((k) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.85rem', textTransform: 'capitalize' }}>
            <input type="checkbox" checked={!!map[k]} onChange={() => toggle(k)} /> {k}
          </label>
        ))}
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
        Saved as <code>{'{'} billing: true, ... {'}'}</code> to match the backend <code>Map</code>. UI gating is cosmetic — the server enforces.
      </p>
    </div>
  );
};

export default PermissionMatrix;
