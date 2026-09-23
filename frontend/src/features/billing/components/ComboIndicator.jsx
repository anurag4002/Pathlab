import React from 'react';

// Phase 22 — combo indicator: shows which selected items came from a
// package/panel bundle (package pricing applied over individual rates).
const ComboIndicator = ({ items = [] }) => {
  const combos = items.filter((i) => i.comboName || i.itemType === 'Package' || i.itemType === 'Panel');
  if (combos.length === 0) return null;
  const groups = combos.reduce((acc, i) => {
    const k = i.comboName || `${i.itemType}:${i.comboId || i.name}`;
    acc[k] = acc[k] || [];
    acc[k].push(i);
    return acc;
  }, {});
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
      {Object.entries(groups).map(([name, members]) => (
        <div
          key={name}
          style={{
            fontSize: '0.78rem', padding: '6px 10px', borderRadius: '6px',
            background: 'var(--primary-light)', border: '1px dashed var(--primary-color)',
            color: 'var(--primary-color)',
          }}
        >
          Combo: <strong>{name}</strong> — {members.length} item{members.length > 1 ? 's' : ''} at bundle price
          (package total replaces individual rates).
        </div>
      ))}
    </div>
  );
};

export default ComboIndicator;
