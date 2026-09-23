import React from 'react';

// Phase 1 — Report Inbox & Worklist tabs + department quick-filter chips.

export const WORKLIST_TABS = [
  { key: 'today', label: 'Today' },
  { key: 'due', label: 'Due' },
  { key: 'pending', label: 'Pending (samples)' },
];

const WorklistTabs = ({ active = 'today', onChange, counts = {} }) => {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="tablist" aria-label="Report worklist">
      {WORKLIST_TABS.map((tab) => {
        const isActive = active === tab.key;
        const count = counts[tab.key];
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange && onChange(tab.key)}
            className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            {tab.label}
            {typeof count === 'number' && (
              <span style={{ marginLeft: '6px', opacity: 0.85, fontWeight: 700 }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export const DepartmentFilterChips = ({ options = ['All'], value = 'All', onChange }) => {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }} aria-label="Department filter">
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dept:</span>
      {options.map((dept) => {
        const isActive = value === dept;
        return (
          <button
            key={dept}
            onClick={() => onChange && onChange(dept)}
            className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '3px 10px', fontSize: '0.72rem' }}
          >
            {dept}
          </button>
        );
      })}
    </div>
  );
};

export default WorklistTabs;
