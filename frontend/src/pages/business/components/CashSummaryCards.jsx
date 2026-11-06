import React from 'react';
import formatCurrency from '../../../utils/formatCurrency';
import StatGroup from '../../../components/common/StatGroup/StatGroup';
import { useUiVersion } from '../../../utils/uiVersion';

// Phase 18 — date-range summary cards for the cashbook.
const CashSummaryCards = ({ income = 0, refunds = 0, net = 0, count = 0 }) => {
  const cards = [
    { label: 'Cash in', value: income, color: 'var(--color-success)' },
    { label: 'Cash out (refunds)', value: refunds, color: 'var(--color-danger)' },
    { label: 'Net cash', value: net, color: 'var(--primary-color)' },
  ];
  const isV2 = useUiVersion() === 'v2';
  if (isV2) {
    return (
      <StatGroup label="Cash summary" items={[
        { label: 'Cash in', value: formatCurrency(income) },
        { label: 'Cash out (refunds)', value: formatCurrency(refunds), tone: refunds > 0 ? 'danger' : undefined },
        { label: 'Net cash', value: formatCurrency(net) },
        { label: 'Transactions', value: String(count) },
      ]} />
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px', marginBottom: '1rem' }}>
      {cards.map((c) => (
        <div key={c.label} className="card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>{c.label}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: c.color }}>{formatCurrency(c.value)}</div>
        </div>
      ))}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Transactions</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{count}</div>
      </div>
    </div>
  );
};

export default CashSummaryCards;
