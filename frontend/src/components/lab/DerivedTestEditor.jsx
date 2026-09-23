import React from 'react';
import { Input } from '../common';

/**
 * Phase 2 — derived-test editor: isDerived checkbox + formula + child-test list.
 * `tests` = all available tests for the child checklist (optional).
 * `childIds` = array of selected child test ids (stored alongside formula; the
 * backend keeps `formula` text — childIds are a UI helper, also embedded as
 * `FORMULA_CHILD_IDS` comment-free metadata only if the caller sends them).
 */
const DerivedTestEditor = ({
  isDerived = false,
  formula = '',
  childIds = [],
  tests = [],
  onChange,
  error = ''
}) => {
  const toggleChild = (id) => {
    const next = childIds.includes(id) ? childIds.filter((c) => c !== id) : [...childIds, id];
    onChange({ childIds: next });
  };

  return (
    <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
      <legend style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0 6px' }}>Derived Test</legend>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '8px' }}>
        <input
          type="checkbox"
          checked={!!isDerived}
          onChange={(e) => onChange({ isDerived: e.target.checked })}
        />
        <span style={{ fontWeight: 600 }}>This is a derived (calculated) test</span>
      </label>

      {isDerived && (
        <>
          <Input
            label="Formula"
            name="formula"
            value={formula}
            onChange={(e) => onChange({ formula: e.target.value })}
            error={error}
            placeholder="e.g. (HGB / HCT) * 100  — use test codes"
            helperText="Use test codes as variables. Evaluated client-side only until a server endpoint exists."
          />
          {tests.length > 0 && (
            <div className="form-group">
              <label className="form-label">Child tests used in formula</label>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '140px', overflowY: 'auto', padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {tests.map((t) => (
                  <label key={t._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={childIds.includes(t._id)} onChange={() => toggleChild(t._id)} />
                    <span>{t.code} — {t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
};

export default DerivedTestEditor;
