import React from 'react';
import { Select } from '../../../components/common';
import { PAYMENT_METHODS } from '../../../constants/billConstants';

// Phase 18 — payment-mode + type filter bar for the cashbook.
const ModeFilter = ({ mode, setMode, type, setType, onReset }) => (
  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
    <Select
      placeholder="All modes"
      value={mode}
      onChange={(e) => setMode(e.target.value)}
      options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
      style={{ minWidth: '170px', marginBottom: 0 }}
    />
    <Select
      placeholder="All types"
      value={type}
      onChange={(e) => setType(e.target.value)}
      options={[
        { value: 'Income', label: 'Cash in (Income)' },
        { value: 'Refund', label: 'Cash out (Refund)' },
        { value: 'Expense', label: 'Expense' },
      ]}
      style={{ minWidth: '170px', marginBottom: 0 }}
    />
    {(mode || type) && (
      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }} onClick={onReset}>
        Clear
      </button>
    )}
  </div>
);

export default ModeFilter;
