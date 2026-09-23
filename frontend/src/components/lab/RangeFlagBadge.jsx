import React from 'react';

/**
 * Phase 2 — badge flagging a numeric result against a test's numeric ranges.
 * Pure client-side; returns null when no ranges/value are present (never blocks entry).
 */
export const getRangeFlag = (value, test = {}) => {
  const num = Number(value);
  if (value === undefined || value === null || value === '' || isNaN(num)) return null;
  const { normalLow, normalHigh, criticalLow, criticalHigh } = test;
  if (criticalLow !== undefined && criticalLow !== null && criticalLow !== '' && num <= Number(criticalLow)) return 'CRITICAL_LOW';
  if (criticalHigh !== undefined && criticalHigh !== null && criticalHigh !== '' && num >= Number(criticalHigh)) return 'CRITICAL_HIGH';
  if (normalLow !== undefined && normalLow !== null && normalLow !== '' && num < Number(normalLow)) return 'LOW';
  if (normalHigh !== undefined && normalHigh !== null && normalHigh !== '' && num > Number(normalHigh)) return 'HIGH';
  if (normalLow !== null && normalLow !== undefined && normalLow !== '' && normalHigh !== null && normalHigh !== undefined && normalHigh !== '') return 'NORMAL';
  return null;
};

const FLAG_STYLES = {
  NORMAL: { bg: '#dcfce7', fg: '#166534', label: 'Normal' },
  LOW: { bg: '#fef9c3', fg: '#854d0e', label: 'Low' },
  HIGH: { bg: '#fef9c3', fg: '#854d0e', label: 'High' },
  CRITICAL_LOW: { bg: '#fee2e2', fg: '#991b1b', label: 'Critical Low' },
  CRITICAL_HIGH: { bg: '#fee2e2', fg: '#991b1b', label: 'Critical High' }
};

const RangeFlagBadge = ({ value, test }) => {
  const flag = getRangeFlag(value, test);
  if (!flag) return null;
  const s = FLAG_STYLES[flag];
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: s.bg, color: s.fg, padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

export default RangeFlagBadge;
