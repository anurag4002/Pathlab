import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer, RefreshCw } from 'lucide-react';
import { getDailyBusiness } from '../../../services/dashboardService';
import { getExpenses } from '../../../services/expenseService';
import { getBills } from '../../../services/billService';
import { downloadServerCsv } from '../../../services/exportService';
import { PageHeader, Button, StatGroup } from '../../../components/common';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport, { fetchAllPages } from '../../../utils/printReport';
import { money, dayLabel, sum } from '../../../utils/reportFormat';
import { notify } from '../../../components/common/Toast/toast';
import '../../../components/business/business.css';
import './monthly.css';

const thisMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };
const monthRange = (value) => {
  const [y, m] = value.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${value}-01`,
    to: `${value}-${String(last).padStart(2, '0')}`,
    label: new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  };
};
const stepMonth = (value, delta) => {
  const [y, m] = value.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const localDay = (value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA'); };

// Monthly summary (new look): the month at a glance - totals, one line per
// day with business, and where the money came from and went.
export default function MonthlySummary() {
  const [month, setMonth] = useState(thisMonth);
  const range = useMemo(() => monthRange(month), [month]);
  const [ledger, setLedger] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    Promise.allSettled([
      getDailyBusiness(range.from, `${range.to}T23:59:59.999`),
      getExpenses({ startDate: range.from, endDate: range.to }),
      fetchAllPages(async (p, size) => {
        const res = await getBills({ startDate: range.from, endDate: range.to, excludeCancelled: 'true', page: p, limit: size });
        return { items: res?.data?.bills || [], pages: res?.data?.pagination?.pages || 1 };
      }),
    ]).then(([biz, exp, list]) => {
      if (cancelled) return;
      if (biz.status === 'fulfilled' && biz.value?.success) setLedger(biz.value.data);
      else { setLedger(null); setError('Could not load the figures for this month.'); }
      setExpenses(exp.status === 'fulfilled' && exp.value?.success && Array.isArray(exp.value.data) ? exp.value.data : []);
      setBills(list.status === 'fulfilled' ? list.value : []);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range, reload]);

  const received = Number(ledger?.totalIncome) || 0;
  const refunded = Number(ledger?.totalRefunds) || 0;
  const spent = Number(ledger?.totalExpenses ?? sum(expenses, (e) => e.amount)) || 0;
  const profit = Number(ledger?.netIncome ?? received - refunded - spent) || 0;
  const billed = sum(bills, (b) => b.totalAmount);
  const toCollect = sum(bills, (b) => b.dueAmount);

  // One line per day that had any business.
  const days = useMemo(() => {
    const map = new Map();
    const row = (date) => {
      if (!map.has(date)) map.set(date, { date, bills: 0, billed: 0, received: 0, spent: 0, profit: 0 });
      return map.get(date);
    };
    (ledger?.monthlyOverview || []).forEach((d) => {
      const date = String(d.date || '').slice(0, 10);
      if (date < range.from || date > range.to) return;
      const r = row(date);
      r.received += Number(d.income) || 0;
      r.spent += Number(d.expenses) || 0;
      r.profit += Number(d.net) || 0;
    });
    bills.forEach((b) => {
      const date = localDay(b.date || b.createdAt);
      if (!date || date < range.from || date > range.to) return;
      const r = row(date);
      r.bills += 1;
      r.billed += Number(b.totalAmount) || 0;
    });
    return [...map.values()].filter((r) => r.bills || r.received || r.spent || r.profit).sort((a, b) => a.date.localeCompare(b.date));
  }, [ledger, bills, range]);

  const modes = useMemo(() => {
    const split = ledger?.incomeSplit && typeof ledger.incomeSplit === 'object' && !Array.isArray(ledger.incomeSplit) ? ledger.incomeSplit : {};
    const names = [...new Set([...Object.keys(split), ...expenses.map((e) => e.paymentMethod || 'Other')])];
    return names.map((mode) => ({
      mode,
      received: Number(split[mode]) || 0,
      spent: sum(expenses.filter((e) => (e.paymentMethod || 'Other') === mode), (e) => e.amount),
    })).filter((m) => m.received || m.spent);
  }, [ledger, expenses]);

  const categories = useMemo(() => {
    const map = new Map();
    expenses.forEach((e) => {
      const key = e.category || 'Other';
      const cur = map.get(key) || { category: key, count: 0, total: 0 };
      cur.count += 1; cur.total += Number(e.amount) || 0;
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [expenses]);

  const split = Array.isArray(ledger?.caseSplit) ? ledger.caseSplit : [];
  const isCurrent = month >= thisMonth();

  const print = () => printReport({
    title: 'Monthly summary',
    period: range.label,
    summary: [
      { label: 'Bills made', value: String(bills.length) },
      { label: 'Billed', value: money(billed) },
      { label: 'Received', value: money(received) },
      { label: 'Still to collect', value: money(toCollect) },
      { label: 'Spent', value: money(spent) },
      { label: 'Refunded', value: money(refunded) },
      { label: 'Profit', value: money(profit) },
    ],
    sections: [
      {
        title: 'Day by day',
        columns: [{ label: 'Date' }, { label: 'Bills', align: 'right' }, { label: 'Billed', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Spent', align: 'right' }, { label: 'Profit', align: 'right' }],
        rows: days.map((d) => [dayLabel(d.date), String(d.bills), money(d.billed), money(d.received), money(d.spent), money(d.profit)]),
        totals: ['Total', String(sum(days, (d) => d.bills)), money(sum(days, (d) => d.billed)), money(sum(days, (d) => d.received)), money(sum(days, (d) => d.spent)), money(sum(days, (d) => d.profit))],
        empty: 'No business recorded this month.',
      },
      modes.length > 0 && {
        title: 'By payment mode',
        columns: [{ label: 'Mode' }, { label: 'Received', align: 'right' }, { label: 'Spent', align: 'right' }],
        rows: modes.map((m) => [m.mode, money(m.received), money(m.spent)]),
        totals: ['Total', money(sum(modes, (m) => m.received)), money(sum(modes, (m) => m.spent))],
      },
      split.length > 0 && {
        title: 'By department',
        columns: [{ label: 'Department' }, { label: 'Bills', align: 'right' }, { label: 'Billed', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Still to collect', align: 'right' }],
        rows: split.map((c) => [c.department, String(c.count ?? ''), money(c.billed), money(c.collected), money(c.due)]),
        totals: ['Total', String(sum(split, (c) => c.count)), money(sum(split, (c) => c.billed)), money(sum(split, (c) => c.collected)), money(sum(split, (c) => c.due))],
      },
      categories.length > 0 && {
        title: 'Expenses by category',
        columns: [{ label: 'Category' }, { label: 'Entries', align: 'right' }, { label: 'Spent', align: 'right' }],
        rows: categories.map((c) => [c.category, String(c.count), money(c.total)]),
        totals: ['Total', String(expenses.length), money(sum(categories, (c) => c.total))],
      },
    ],
    note: 'Received counts payments made this month. Billed and still to collect are for bills made this month. Days with no business are left out.',
  });

  const download = (dataset, what) => async () => {
    try { await downloadServerCsv(dataset, { startDate: range.from, endDate: range.to }); } catch { notify(`Could not download ${what}. Try again.`); }
  };

  return (
    <div className="biz-page">
      <PageHeader
        title="Monthly summary"
        subtitle="How the month went: money in and out, day by day."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[
              { label: 'Money received (CSV)', onClick: download('transactions', 'payments') },
              { label: 'Bills made (CSV)', onClick: download('bills', 'bills') },
              { label: 'Expenses (CSV)', onClick: download('expenses', 'expenses') },
            ]} />
          </div>
        }
      />

      <div className="biz-period">
        <div className="biz-month-step" role="group" aria-label="Month">
          <button type="button" aria-label="Previous month" onClick={() => setMonth((m) => stepMonth(m, -1))}><ChevronLeft size={16} /></button>
          <span className="biz-month-label" aria-live="polite">{range.label}</span>
          <button type="button" aria-label="Next month" disabled={isCurrent} onClick={() => setMonth((m) => stepMonth(m, 1))}><ChevronRight size={16} /></button>
        </div>
        <input className="biz-month-input" type="month" aria-label="Pick a month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        {!isCurrent && <button type="button" className="biz-month-today" onClick={() => setMonth(thisMonth())}>This month</button>}
      </div>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Bills made', value: String(bills.length), hint: `${money(billed)} billed` },
        { label: 'Received', value: money(received), hint: refunded ? `${money(refunded)} refunded` : 'All payment modes' },
        { label: 'Still to collect', value: money(toCollect), hint: 'On this month\'s bills', tone: toCollect > 0 ? 'warning' : undefined, to: toCollect > 0 ? '/business/dues' : undefined },
        { label: 'Spent', value: money(spent), hint: `${expenses.length} expense${expenses.length === 1 ? '' : 's'}` },
        { label: 'Profit', value: money(profit), hint: 'Received - refunds - spent', tone: profit < 0 ? 'danger' : 'good' },
      ]} />

      <section className="biz-section" aria-label="Day by day">
        <div className="biz-section-head"><h2>Day by day</h2><p>Only days with business are listed.</p></div>
        <ReportTable loading={loading} rows={days} rowKey={(d) => d.date} empty="No business recorded this month."
          columns={[
            { key: 'date', label: 'Date', render: (d) => <span className="strong">{dayLabel(d.date)}</span> },
            { key: 'bills', label: 'Bills made', align: 'right' },
            { key: 'billed', label: 'Billed', align: 'right', render: (d) => money(d.billed) },
            { key: 'received', label: 'Received', align: 'right', render: (d) => money(d.received) },
            { key: 'spent', label: 'Spent', align: 'right', render: (d) => money(d.spent) },
            { key: 'profit', label: 'Profit', align: 'right', render: (d) => <span className={d.profit < 0 ? 'is-due' : 'strong'}>{money(d.profit)}</span> },
          ]}
          totals={{ date: 'Total', bills: String(sum(days, (d) => d.bills)), billed: money(sum(days, (d) => d.billed)), received: money(sum(days, (d) => d.received)), spent: money(sum(days, (d) => d.spent)), profit: money(sum(days, (d) => d.profit)) }} />
      </section>

      <div className="biz-grid-2">
        <section className="biz-section" aria-label="By payment mode">
          <div className="biz-section-head"><h2>By payment mode</h2></div>
          <ReportTable loading={loading} rows={modes} rowKey={(m) => m.mode} empty="No money moved this month."
            columns={[
              { key: 'mode', label: 'Mode', render: (m) => <span className="strong">{m.mode}</span> },
              { key: 'received', label: 'Received', align: 'right', render: (m) => money(m.received) },
              { key: 'spent', label: 'Spent', align: 'right', render: (m) => money(m.spent) },
            ]}
            totals={{ mode: 'Total', received: money(sum(modes, (m) => m.received)), spent: money(sum(modes, (m) => m.spent)) }} />
        </section>
        <section className="biz-section" aria-label="Expenses by category">
          <div className="biz-section-head"><h2>Expenses by category</h2></div>
          <ReportTable loading={loading} rows={categories} rowKey={(c) => c.category} empty="No expenses this month."
            columns={[
              { key: 'category', label: 'Category', render: (c) => <span className="strong">{c.category}</span> },
              { key: 'count', label: 'Entries', align: 'right' },
              { key: 'total', label: 'Spent', align: 'right', render: (c) => money(c.total) },
            ]}
            totals={{ category: 'Total', count: String(expenses.length), total: money(sum(categories, (c) => c.total)) }} />
        </section>
      </div>

      <section className="biz-section" aria-label="By department">
        <div className="biz-section-head"><h2>By department</h2><p>Bills made this month, by department.</p></div>
        <ReportTable loading={loading} rows={split} rowKey={(c) => c.department} empty="No bills this month."
          columns={[
            { key: 'department', label: 'Department', render: (c) => <span className="strong">{c.department}</span> },
            { key: 'count', label: 'Bills', align: 'right' },
            { key: 'billed', label: 'Billed', align: 'right', render: (c) => money(c.billed) },
            { key: 'collected', label: 'Received', align: 'right', render: (c) => money(c.collected) },
            { key: 'due', label: 'Still to collect', align: 'right', render: (c) => (Number(c.due) > 0 ? <span className="is-due">{money(c.due)}</span> : money(0)) },
          ]}
          totals={{ department: 'Total', count: String(sum(split, (c) => c.count)), billed: money(sum(split, (c) => c.billed)), collected: money(sum(split, (c) => c.collected)), due: money(sum(split, (c) => c.due)) }} />
      </section>
    </div>
  );
}
