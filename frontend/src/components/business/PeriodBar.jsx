import React from 'react';
import { CalendarDays } from 'lucide-react';
import { periodLabel } from '../../utils/reportFormat';
import { istToday, addIstDays } from '../../utils/labDateTime';

// Business screens (new look): one row to pick the period - Today,
// Yesterday, Last 7 days, This month, Last month or your own dates - plus a
// slot on the right for the page's own filters. Dates never run backwards.
// Days are IST calendar days (YYYY-MM-DD), whatever the browser timezone.
const shift = (days) => addIstDays(istToday(), days);
const monthStart = (day) => `${day.slice(0, 8)}01`;

export const PRESETS = {
  today: { label: 'Today', range: () => [istToday(), istToday()] },
  yesterday: { label: 'Yesterday', range: () => [shift(-1), shift(-1)] },
  week: { label: 'Last 7 days', range: () => [shift(-6), istToday()] },
  days30: { label: 'Last 30 days', range: () => [shift(-29), istToday()] },
  month: { label: 'This month', range: () => { const t = istToday(); return [monthStart(t), t]; } },
  lastMonth: { label: 'Last month', range: () => { const end = addIstDays(monthStart(istToday()), -1); return [monthStart(end), end]; } },
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
