// Plain words for business reports (screen in the new look, and print).
import formatCurrency from './formatCurrency';

const CASE_TYPE_LABELS = {
  LabCase: 'Lab', UsgCase: 'USG', DigitalXrayCase: 'Digital X-ray', XrayCase: 'X-ray',
  OutsourceLabCase: 'Outsource', EcgCase: 'ECG', CtScanCase: 'CT scan', MriCase: 'MRI',
  EpsCase: 'EPS', OpgCase: 'OPG', CardiologyCase: 'Cardiology', EegCase: 'EEG', MammographyCase: 'Mammography',
};
export const caseTypeLabel = (type) => CASE_TYPE_LABELS[type] || (type ? String(type).replace(/Case$/, '') : 'Lab');

export const money = (value) => formatCurrency(Number(value) || 0);

export const dayLabel = (value) => {
  if (!value) return '';
  const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const dateTimeLabel = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

/** "1 Nov 2026 - 6 Nov 2026", "6 Nov 2026", or "All dates". */
export const periodLabel = (from, to) => {
  if (!from && !to) return 'All dates';
  if (from && to && from === to) return dayLabel(from);
  if (from && to) return `${dayLabel(from)} - ${dayLabel(to)}`;
  return from ? `From ${dayLabel(from)}` : `Up to ${dayLabel(to)}`;
};

export const sum = (rows, pick) => rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);

/** CSV download that works for any rows (all of them, not one page). */
export function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
