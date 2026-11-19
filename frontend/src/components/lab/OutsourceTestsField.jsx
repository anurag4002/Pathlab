import React from 'react';

// "This report contains: [x] HbA1c [x] Vitamin D [ ] Thyroid" — the outside
// lab may send one file for several tests or one per test, so each upload is
// tagged with the tests it holds. Each test also says whether a file already
// covers it ("Uploaded · file") or it is still "Waiting for report".
// Without `onChange` it only shows that coverage (no checkboxes).
export default function OutsourceTestsField({ info, selected = [], onChange, title }) {
  const tests = info?.tests || [];
  const coverage = info?.coverage || [];
  if (!tests.length) return null;
  const picking = typeof onChange === 'function';
  const isOn = (name) => selected.some((s) => s.toLowerCase() === name.toLowerCase());
  const toggle = (name) => {
    if (!picking) return;
    onChange(isOn(name) ? selected.filter((s) => s.toLowerCase() !== name.toLowerCase()) : [...selected, name]);
  };
  const heading = title || (picking ? 'This file contains' : 'Outsourced tests');
  return (
    <fieldset className="outsource-tests" style={{ border: '1px solid var(--color-border, #e2e8f0)', borderRadius: 8, padding: '8px 12px', margin: 0 }}>
      <legend style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, padding: '0 4px' }}>{heading}</legend>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {tests.map((name) => {
          const row = coverage.find((r) => r.name === name) || { covered: false };
          const status = row.covered
            ? `Uploaded${row.fileName ? ` · ${row.fileName}` : ''}`
            : 'Waiting for report';
          const id = `outsource-test-${name.replace(/[^a-z0-9]+/gi, '-')}`;
          return (
            <li key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 'var(--font-size-sm)' }}>
              {picking ? (
                <input id={id} type="checkbox" checked={isOn(name)} onChange={() => toggle(name)} />
              ) : null}
              <label htmlFor={picking ? id : undefined} style={{ fontWeight: 500, cursor: picking ? 'pointer' : 'default' }}>{name}</label>
              <span
                className="cell-sub"
                style={{ color: row.covered ? 'var(--color-success, #166534)' : 'var(--color-text-muted, #64748b)', display: 'inline' }}
              >
                {status}
              </span>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
