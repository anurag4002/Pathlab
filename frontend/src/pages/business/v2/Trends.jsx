import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Printer, RefreshCw } from 'lucide-react';
import { getDailyBusiness, getMonthlyTrends } from '../../../services/dashboardService';
import { PageHeader, Button, StatGroup } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import ReportTable from '../../../components/business/ReportTable';
import { SvgBars, SvgLine } from '../../../components/charts/SvgCharts';
import printReport from '../../../utils/printReport';
import { money, dayLabel, periodLabel, sum } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import './monthly.css';

const DAY = 86400000;
const iso = (d) => d.toLocaleDateString('en-CA');
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
// The same number of days, just before the chosen period.
const previousRange = (from, to) => {
  const start = parse(from); const end = parse(to);
  const days = Math.round((end - start) / DAY) + 1;
  const prevEnd = new Date(start.getTime() - DAY);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * DAY);
  return [iso(prevStart), iso(prevEnd), days];
};
const figures = (d) => {
  const received = Number(d?.totalIncome) || 0;
  const refunded = Number(d?.totalRefunds) || 0;
  const spent = Number(d?.totalExpenses) || 0;
  const split = Array.isArray(d?.caseSplit) ? d.caseSplit : [];
  return {
    received, refunded, spent,
    profit: Number(d?.netIncome ?? received - refunded - spent) || 0,
    bills: sum(split, (c) => c.count),
    billed: sum(split, (c) => c.billed),
  };
};
const changeOf = (now, before) => {
  if (!before && !now) return null;
  if (!before) return { pct: null, dir: now > 0 ? 'up' : 'down' };
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
};

function Change({ now, before, lowerIsBetter = false }) {
  const c = changeOf(now, before);
  if (!c) return <span className="biz-change is-flat">No change</span>;
  if (c.dir === 'flat') return <span className="biz-change is-flat">Same</span>;
  if (c.pct === null) return <span className="biz-change is-flat">Nothing before</span>;
  const good = lowerIsBetter ? c.dir === 'down' : c.dir === 'up';
  const Icon = c.dir === 'up' ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`biz-change ${good ? 'is-up' : 'is-down'}`}>
      <Icon size={14} aria-hidden="true" />{`${Math.abs(c.pct)}% ${c.dir === 'up' ? 'more' : 'less'}`}
    </span>
  );
}

// Trends (new look): is business going up or down? This period next to the
// same number of days before it, plus where the money comes from.
export default function Trends() {
  const [[from, to], setRange] = useState(() => presetRange('week'));
  const [now, setNow] = useState(null);
  const [before, setBefore] = useState(null);
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [prevFrom, prevTo, dayCount] = useMemo(() => previousRange(from, to), [from, to]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    Promise.allSettled([
      getDailyBusiness(from, `${to}T23:59:59.999`),
      getDailyBusiness(prevFrom, `${prevTo}T23:59:59.999`),
      getMonthlyTrends(),
    ]).then(([a, b, t]) => {
      if (cancelled) return;
      if (a.status === 'fulfilled' && a.value?.success) setNow(a.value.data);
      else { setNow(null); setError('Could not load the figures for this period.'); }
      setBefore(b.status === 'fulfilled' && b.value?.success ? b.value.data : null);
      const tr = t.status === 'fulfilled' ? t.value?.data : null;
      setMonths(Array.isArray(tr) ? tr : tr?.trends || []);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, prevFrom, prevTo, reload]);

  const cur = figures(now);
  const prev = figures(before);
  const prevLabel = periodLabel(prevFrom, prevTo);

  const compare = [
    { key: 'received', label: 'Received', now: cur.received, before: prev.received, fmt: money },
    { key: 'bills', label: 'Bills made', now: cur.bills, before: prev.bills, fmt: (v) => String(v) },
    { key: 'billed', label: 'Billed', now: cur.billed, before: prev.billed, fmt: money },
    { key: 'spent', label: 'Spent', now: cur.spent, before: prev.spent, fmt: money, lowerIsBetter: true },
    { key: 'refunded', label: 'Refunded', now: cur.refunded, before: prev.refunded, fmt: money, lowerIsBetter: true },
    { key: 'profit', label: 'Profit', now: cur.profit, before: prev.profit, fmt: money },
  ];

  const daily = useMemo(() => (now?.monthlyOverview || [])
    .map((d) => ({ date: String(d.date || '').slice(0, 10), value: Number(d.income) || 0 }))
    .filter((d) => d.date >= from && d.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date)), [now, from, to]);

  const modes = useMemo(() => {
    const split = now?.incomeSplit && typeof now.incomeSplit === 'object' && !Array.isArray(now.incomeSplit) ? now.incomeSplit : {};
    const list = Object.entries(split).map(([mode, v]) => ({ mode, value: Number(v) || 0 })).filter((m) => m.value > 0).sort((a, b) => b.value - a.value);
    const total = sum(list, (m) => m.value);
    return list.map((m) => ({ ...m, share: total ? Math.round((m.value / total) * 100) : 0 }));
  }, [now]);

  const departments = useMemo(() => {
    const list = [...(now?.caseSplit || [])].sort((a, b) => (Number(b.billed) || 0) - (Number(a.billed) || 0));
    const total = sum(list, (c) => c.billed);
    return list.map((c) => ({ ...c, share: total ? Math.round(((Number(c.billed) || 0) / total) * 100) : 0 }));
  }, [now]);

  const people = useMemo(() => [...(now?.cashierWise || [])].sort((a, b) => (b.income || 0) - (a.income || 0)), [now]);
  const monthLine = months.map((m) => ({ label: m.month, value: Number(m.revenue) || 0 }));
  const hasMonths = monthLine.some((m) => m.value > 0);

  const shareCell = (share) => <><span className="biz-bar"><span style={{ width: `${share}%` }} /></span><span className="biz-share">{share}%</span></>;

  const print = () => printReport({
    title: 'Trends',
    period: `${periodLabel(from, to)} compared with ${prevLabel}`,
    summary: [
      { label: 'Received', value: money(cur.received) },
      { label: 'Spent', value: money(cur.spent) },
      { label: 'Profit', value: money(cur.profit) },
      { label: 'Bills made', value: String(cur.bills) },
    ],
    sections: [
      {
        title: 'This period and the one before',
        columns: [{ label: '' }, { label: 'This period', align: 'right' }, { label: 'Before', align: 'right' }, { label: 'Change', align: 'right' }],
        rows: compare.map((r) => {
          const c = changeOf(r.now, r.before);
          const change = !c ? '-' : c.dir === 'flat' ? 'Same' : c.pct === null ? 'Nothing before' : `${c.dir === 'up' ? '+' : '-'}${Math.abs(c.pct)}%`;
          return [r.label, r.fmt(r.now), r.fmt(r.before), change];
        }),
      },
      daily.length > 1 && {
        title: 'Received each day',
        columns: [{ label: 'Date' }, { label: 'Received', align: 'right' }],
        rows: daily.map((d) => [dayLabel(d.date), money(d.value)]),
        totals: ['Total', money(sum(daily, (d) => d.value))],
      },
      modes.length > 0 && {
        title: 'Received by payment mode',
        columns: [{ label: 'Mode' }, { label: 'Received', align: 'right' }, { label: 'Share', align: 'right' }],
        rows: modes.map((m) => [m.mode, money(m.value), `${m.share}%`]),
      },
      departments.length > 0 && {
        title: 'Departments',
        columns: [{ label: 'Department' }, { label: 'Bills', align: 'right' }, { label: 'Billed', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Share', align: 'right' }],
        rows: departments.map((c) => [c.department, String(c.count ?? ''), money(c.billed), money(c.collected), `${c.share}%`]),
      },
    ],
  });

  return (
    <div className="biz-page">
      <PageHeader
        title="Trends"
        subtitle="Is business going up or down, compared with the days before?"
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
          </div>
        }
      />

      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])} presets={['today', 'week', 'days30', 'month', 'lastMonth']} />

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Received', value: money(cur.received), hint: <Change now={cur.received} before={prev.received} /> },
        { label: 'Bills made', value: String(cur.bills), hint: <Change now={cur.bills} before={prev.bills} /> },
        { label: 'Spent', value: money(cur.spent), hint: <Change now={cur.spent} before={prev.spent} lowerIsBetter /> },
        { label: 'Profit', value: money(cur.profit), hint: <Change now={cur.profit} before={prev.profit} />, tone: cur.profit < 0 ? 'danger' : 'good' },
      ]} />

      <section className="biz-section" aria-label="Compared with before">
        <div className="biz-section-head"><h2>Compared with before</h2><p>Before = {prevLabel} ({dayCount} day{dayCount === 1 ? '' : 's'}).</p></div>
        <ReportTable loading={loading} rows={compare} rowKey={(r) => r.key}
          columns={[
            { key: 'label', label: '', render: (r) => <span className="strong">{r.label}</span> },
            { key: 'now', label: 'This period', align: 'right', render: (r) => <span className="strong">{r.fmt(r.now)}</span> },
            { key: 'before', label: 'Before', align: 'right', render: (r) => <span className="muted">{r.fmt(r.before)}</span> },
            { key: 'change', label: 'Change', align: 'right', render: (r) => <Change now={r.now} before={r.before} lowerIsBetter={r.lowerIsBetter} /> },
          ]} />
      </section>

      {daily.length > 1 && (
        <section className="biz-section" aria-label="Received each day">
          <div className="biz-section-head"><h2>Received each day</h2></div>
          <div className="biz-chart-card">
            <SvgBars data={daily.map((d) => ({ label: dayLabel(d.date).replace(/ \d{4}$/, ''), value: d.value }))} height={200} label="Money received each day" formatValue={(v) => money(v)} />
          </div>
        </section>
      )}

      <div className="biz-grid-2">
        <section className="biz-section" aria-label="By payment mode">
          <div className="biz-section-head"><h2>By payment mode</h2></div>
          <ReportTable loading={loading} rows={modes} rowKey={(m) => m.mode} empty="No money received in this period."
            columns={[
              { key: 'mode', label: 'Mode', render: (m) => <span className="strong">{m.mode}</span> },
              { key: 'value', label: 'Received', align: 'right', render: (m) => money(m.value) },
              { key: 'share', label: 'Share', render: (m) => shareCell(m.share) },
            ]} />
        </section>
        <section className="biz-section" aria-label="Who received money">
          <div className="biz-section-head"><h2>Who received money</h2></div>
          <ReportTable loading={loading} rows={people} rowKey={(p) => p.name} empty="No money received in this period."
            columns={[
              { key: 'name', label: 'Person', render: (p) => <span className="strong">{p.name || 'Unknown'}</span> },
              { key: 'count', label: 'Payments', align: 'right' },
              { key: 'income', label: 'Received', align: 'right', render: (p) => money(p.income) },
            ]} />
        </section>
      </div>

      <section className="biz-section" aria-label="Departments">
        <div className="biz-section-head"><h2>Departments</h2><p>Which departments bring in the most.</p></div>
        <ReportTable loading={loading} rows={departments} rowKey={(c) => c.department} empty="No bills in this period."
          columns={[
            { key: 'department', label: 'Department', render: (c) => <span className="strong">{c.department}</span> },
            { key: 'count', label: 'Bills', align: 'right' },
            { key: 'billed', label: 'Billed', align: 'right', render: (c) => money(c.billed) },
            { key: 'collected', label: 'Received', align: 'right', render: (c) => money(c.collected) },
            { key: 'share', label: 'Share of billing', render: (c) => shareCell(c.share) },
          ]} />
      </section>

      {hasMonths && (
        <section className="biz-section" aria-label="Last 6 months">
          <div className="biz-section-head"><h2>Last 6 months</h2><p>Money received each month.</p></div>
          <div className="biz-chart-card">
            <SvgLine data={monthLine} height={200} label="Money received each month" formatValue={(v) => money(v)} />
          </div>
        </section>
      )}
    </div>
  );
}
