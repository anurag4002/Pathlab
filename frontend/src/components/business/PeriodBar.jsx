import React from 'react';
import { CalendarDays } from 'lucide-react';
import { periodLabel } from '../../utils/reportFormat';

// Business screens (new look): one row to pick the period - Today,
// Yesterday, Last 7 days, This month, Last month or your own dates - plus a
// slot on the right for the page's own filters. Dates never run backwards.
const iso = (d) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d); };

export const PRESETS = {
  today: { label: 'Today', range: () => [iso(new Date()), iso(new Date())] },
  yesterday: { label: 'Yesterday', range: () => [shift(-1), shift(-1)] },
  week: { label: 'Last 7 days', range: () => [shift(-6), iso(new Date())] },
  days30: { label: 'Last 30 days', range: () => [shift(-29), iso(new Date())] },
  month: { label: 'This month', range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(n)]; } },
  lastMonth: { label: 'Last month', range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))]; } },
};

export const presetRange = (key) => PRESETS[key].range();

export default function PeriodBar({ from, to, onChange, presets = ['today', 'yesterday', 'week', 'month', 'lastMonth'], children }) {
  const active = presets.find((key) => { const [a, b] = PRESETS[key].range(); return a === from && b === to; }) || 'custom';
  const setFrom = (value) => onChange({ from: value, to: value && to && value > to ? value : to });
  const setTo = (value) => onChange({ from: value && from && value < from ? value : from, to: value });
  return (
    <div className="biz-period">
      <div className="biz-period-presets" role="group" aria-label="Period">
        {presets.map((key) => (
          <button key={key} type="button" className={active === key ? 'is-on' : ''} aria-pressed={active === key}
            onClick={() => { const [a, b] = PRESETS[key].range(); onChange({ from: a, to: b }); }}>
            {PRESETS[key].label}
          </button>
        ))}
      </div>
      <div className={`biz-period-dates${active === 'custom' ? ' is-on' : ''}`}>
        <CalendarDays size={15} aria-hidden="true" />
        <input type="date" aria-label="From" value={from || ''} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <span aria-hidden="true">to</span>
        <input type="date" aria-label="To" value={to || ''} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>
      {children && <div className="biz-period-extra">{children}</div>}
      <span className="biz-period-label" aria-live="polite">{periodLabel(from, to)}</span>
    </div>
  );
}
