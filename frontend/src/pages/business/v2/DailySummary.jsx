import React, { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { getDailyBusiness } from '../../../services/dashboardService';
import { getExpenses } from '../../../services/expenseService';
import { getBills } from '../../../services/billService';
import { downloadServerCsv } from '../../../services/exportService';
import { PageHeader, Button, StatGroup, StatusBadge } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport, { fetchAllPages } from '../../../utils/printReport';
import { money, dayLabel, dateTimeLabel, periodLabel, sum } from '../../../utils/reportFormat';
import { notify } from '../../../components/common/Toast/toast';
import '../../../components/business/business.css';

const modeClass = (mode) => `biz-pill is-${String(mode || '').toLowerCase()}`;

// Daily summary (new look): what came in, what went out, and what is still
// to collect - for one day or a few days.
export default function DailySummary() {
  const [[from, to], setRange] = useState(() => presetRange('today'));
  const [ledger, setLedger] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('received');
  const [cashier, setCashier] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const end = `${to}T23:59:59.999`;
    Promise.allSettled([
      getDailyBusiness(from, end),
      getExpenses({ startDate: from, endDate: end }),
      fetchAllPages(async (p, size) => {
        const res = await getBills({ startDate: from, endDate: to, excludeCancelled: 'true', page: p, limit: size });
        return { items: res?.data?.bills || [], pages: res?.data?.pagination?.pages || 1 };
      }),
    ]).then(([biz, exp, list]) => {
      if (cancelled) return;
      if (biz.status === 'fulfilled' && biz.value?.success) setLedger(biz.value.data);
      else { setLedger(null); setError('Could not load the money figures for this period.'); }
      setExpenses(exp.status === 'fulfilled' && exp.value?.success ? exp.value.data || [] : []);
      setBills(list.status === 'fulfilled' ? list.value : []);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, reload]);

  const allTx = ledger?.transactions || [];
  const cashiers = [...new Set(allTx.map((t) => t.receivedBy?.name).filter(Boolean))];
  const tx = cashier ? allTx.filter((t) => (t.receivedBy?.name || '') === cashier) : allTx;
  const payments = tx.filter((t) => t.type !== 'Refund');
  const refunds = tx.filter((t) => t.type === 'Refund');

  const received = sum(payments, (t) => t.amount);
  const refunded = sum(refunds, (t) => t.amount);
  const spent = sum(expenses, (e) => e.amount);
  const billed = sum(bills, (b) => b.totalAmount);
  const toCollect = sum(bills, (b) => b.dueAmount);
  const profit = received - refunded - spent;

  // Money by payment mode: received, refunded, spent and what should be in hand.
  const modes = useMemo(() => {
    const names = [...new Set(['Cash', ...tx.map((t) => t.paymentMethod || 'Other'), ...expenses.map((e) => e.paymentMethod || 'Other')])];
    return names.map((mode) => {
      const got = sum(payments.filter((t) => (t.paymentMethod || 'Other') === mode), (t) => t.amount);
      const back = sum(refunds.filter((t) => (t.paymentMethod || 'Other') === mode), (t) => t.amount);
      const out = sum(expenses.filter((e) => (e.paymentMethod || 'Other') === mode), (e) => e.amount);
      return { mode, got, back, out, inHand: got - back - out };
    }).filter((m) => m.mode === 'Cash' || m.got || m.back || m.out);
  }, [tx, payments, refunds, expenses]);

  const split = ledger?.caseSplit || [];

  const print = () => printReport({
    title: 'Daily summary',
    period: periodLabel(from, to),
    filters: [cashier && `Received by: ${cashier}`],
    summary: [
      { label: 'Bills made', value: String(bills.length) },
      { label: 'Billed', value: money(billed) },
      { label: 'Received', value: money(received) },
      { label: 'Still to collect', value: money(toCollect) },
      { label: 'Spent', value: money(spent) },
      { label: 'Profit', value: money(profit) },
    ],
    sections: [
      { title: 'By payment mode', columns: [{ label: 'Mode' }, { label: 'Received', align: 'right' }, { label: 'Refunded', align: 'right' }, { label: 'Spent', align: 'right' }, { label: 'In hand', align: 'right' }], rows: modes.map((m) => [m.mode, money(m.got), money(m.back), money(m.out), money(m.inHand)]) },
      { title: `Money received (${tx.length})`, columns: [{ label: 'Time' }, { label: 'Bill no' }, { label: 'Patient' }, { label: 'Mode' }, { label: 'Received by' }, { label: 'Amount', align: 'right' }], rows: tx.map((t) => [dateTimeLabel(t.date), t.bill?.billNumber || '', t.patient?.name || 'Walk-in', t.paymentMethod || '', t.receivedBy?.name || '', `${t.type === 'Refund' ? 'Refund -' : ''}${money(t.amount)}`]), totals: ['Total', '', '', '', '', money(received - refunded)], empty: 'No money received in this period.' },
      { title: `Bills made (${bills.length})`, columns: [{ label: 'Bill no' }, { label: 'Patient' }, { label: 'Amount', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Still to collect', align: 'right' }], rows: bills.map((b) => [b.billNumber, b.patient?.name || 'Walk-in', money(b.totalAmount), money(b.paidAmount), money(b.dueAmount)]), totals: ['Total', `${bills.length} bills`, money(billed), money(sum(bills, (b) => b.paidAmount)), money(toCollect)], empty: 'No bills were made in this period.' },
      { title: `Expenses (${expenses.length})`, columns: [{ label: 'Date' }, { label: 'Category' }, { label: 'Details' }, { label: 'Paid by' }, { label: 'Amount', align: 'right' }], rows: expenses.map((e) => [dayLabel(e.date), e.category || '', e.description || e.name || '', e.paymentMethod || '', money(e.amount)]), totals: ['Total', '', '', '', money(spent)], empty: 'No expenses in this period.' },
      split.length > 0 && { title: 'By department', columns: [{ label: 'Department' }, { label: 'Bills', align: 'right' }, { label: 'Billed', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Still to collect', align: 'right' }], rows: split.map((c) => [c.department, String(c.count ?? ''), money(c.billed), money(c.collected), money(c.due)]) },
    ],
    note: 'Profit = received - refunded - spent. In hand = what that mode should hold for this period.',
  });

  const download = (dataset, what) => async () => {
    try { await downloadServerCsv(dataset, { startDate: from, endDate: to }); } catch { notify(`Could not download ${what}. Try again.`); }
  };

  const TABS = [
    { key: 'received', label: 'Money received', count: tx.length },
    { key: 'bills', label: 'Bills made', count: bills.length },
    { key: 'expenses', label: 'Expenses', count: expenses.length },
    { key: 'departments', label: 'By department', count: split.length },
  ];

  return (
    <div className="biz-page">
      <PageHeader
        title="Daily summary"
        subtitle="Money in and out, and what is still to collect, for a day or a few days."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)} aria-label="Refresh">Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[
              { label: 'Money received (CSV)', onClick: download('transactions', 'payments') },
              { label: 'Bills made (CSV)', onClick: download('bills', 'bills') },
              { label: 'Expenses (CSV)', onClick: download('expenses', 'expenses') },
            ]} />
          </div>
        }
      />
      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])}>
        {cashiers.length > 1 && (
          <select aria-label="Received by" value={cashier} onChange={(e) => setCashier(e.target.value)}>
            <option value="">Everyone</option>
            {cashiers.map((name) => <option key={name} value={name}>Received by {name}</option>)}
          </select>
        )}
      </PeriodBar>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Bills made', value: String(bills.length), hint: `${money(billed)} billed` },
        { label: 'Received', value: money(received), hint: refunded ? `${money(refunded)} refunded` : 'All payment modes' },
        { label: 'Still to collect', value: money(toCollect), hint: 'On the bills made', tone: toCollect > 0 ? 'warning' : undefined, to: toCollect > 0 ? '/business/dues' : undefined },
        { label: 'Spent', value: money(spent), hint: `${expenses.length} expense${expenses.length === 1 ? '' : 's'}` },
        { label: 'Profit', value: money(profit), hint: 'Received - refunds - spent', tone: profit < 0 ? 'danger' : 'good' },
      ]} />

      <section className="biz-section" aria-label="By payment mode">
        <div className="biz-section-head"><h2>By payment mode</h2><p>"In hand" is what each mode should hold for this period.</p></div>
        <div className="biz-modes">
          {modes.map((m) => (
            <div key={m.mode} className="biz-mode">
              <h3>{m.mode}</h3>
              <dl>
                <dt>Received</dt><dd>{money(m.got)}</dd>
                {m.back > 0 && <><dt>Refunded</dt><dd>- {money(m.back)}</dd></>}
                <dt>Spent</dt><dd>- {money(m.out)}</dd>
                <dt className="is-total">In hand</dt><dd className="is-total">{money(m.inHand)}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="biz-section">
        <div className="biz-tabs" role="tablist" aria-label="Details">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>
              {t.label}<span>{t.count}</span>
            </button>
          ))}
        </div>

        {tab === 'received' && (
          <ReportTable loading={loading} rows={tx} empty={bills.length ? 'No money was received in this period. Unpaid bills are under "Bills made".' : 'No money was received in this period.'}
            columns={[
              { key: 'time', label: 'Time', render: (t) => <span className="muted">{dateTimeLabel(t.date)}</span> },
              { key: 'bill', label: 'Bill no', render: (t) => <span className="strong">{t.bill?.billNumber || ''}</span> },
              { key: 'patient', label: 'Patient', render: (t) => t.patient?.name || 'Walk-in' },
              { key: 'mode', label: 'Mode', render: (t) => <span className={modeClass(t.paymentMethod)}>{t.paymentMethod}</span> },
              { key: 'by', label: 'Received by', render: (t) => t.receivedBy?.name || '' },
              { key: 'amount', label: 'Amount', align: 'right', render: (t) => (t.type === 'Refund' ? <span className="is-due">- {money(t.amount)}</span> : <span className="strong">{money(t.amount)}</span>) },
            ]}
            totals={{ time: 'Total', amount: money(received - refunded) }} />
        )}
        {tab === 'bills' && (
          <ReportTable loading={loading} rows={bills} empty="No bills were made in this period."
            columns={[
              { key: 'bill', label: 'Bill no', render: (b) => <span className="strong">{b.billNumber}</span> },
              { key: 'patient', label: 'Patient', render: (b) => <><div>{b.patient?.name || 'Walk-in'}</div><div className="muted">{b.referringDoctor?.name ? `Dr. ${b.referringDoctor.name.replace(/^dr\.?\s*/i, '')}` : 'Self'}</div></> },
              { key: 'amount', label: 'Amount', align: 'right', render: (b) => money(b.totalAmount) },
              { key: 'paid', label: 'Received', align: 'right', render: (b) => money(b.paidAmount) },
              { key: 'due', label: 'Still to collect', align: 'right', render: (b) => (Number(b.dueAmount) > 0 ? <span className="is-due">{money(b.dueAmount)}</span> : <span className="muted">-</span>) },
              { key: 'status', label: 'Status', render: (b) => <StatusBadge status={b.paymentStatus} /> },
            ]}
            totals={{ bill: 'Total', patient: `${bills.length} bills`, amount: money(billed), paid: money(sum(bills, (b) => b.paidAmount)), due: money(toCollect) }} />
        )}
        {tab === 'expenses' && (
          <ReportTable loading={loading} rows={expenses} empty="No expenses were recorded in this period."
            columns={[
              { key: 'date', label: 'Date', render: (e) => dayLabel(e.date) },
              { key: 'category', label: 'Category', render: (e) => <span className="strong">{e.category}</span> },
              { key: 'details', label: 'Details', render: (e) => e.description || e.name || '' },
              { key: 'mode', label: 'Paid by', render: (e) => <span className={modeClass(e.paymentMethod)}>{e.paymentMethod}</span> },
              { key: 'amount', label: 'Amount', align: 'right', render: (e) => money(e.amount) },
            ]}
            totals={{ date: 'Total', amount: money(spent) }} />
        )}
        {tab === 'departments' && (
          <ReportTable loading={loading} rows={split} rowKey={(c) => c.department} empty="No bills in this period."
            columns={[
              { key: 'department', label: 'Department', render: (c) => <span className="strong">{c.department}</span> },
              { key: 'count', label: 'Bills', align: 'right' },
              { key: 'billed', label: 'Billed', align: 'right', render: (c) => money(c.billed) },
              { key: 'collected', label: 'Received', align: 'right', render: (c) => money(c.collected) },
              { key: 'due', label: 'Still to collect', align: 'right', render: (c) => (Number(c.due) > 0 ? <span className="is-due">{money(c.due)}</span> : money(0)) },
            ]}
            totals={{ department: 'Total', count: String(sum(split, (c) => c.count)), billed: money(sum(split, (c) => c.billed)), collected: money(sum(split, (c) => c.collected)), due: money(sum(split, (c) => c.due)) }} />
        )}
      </section>
    </div>
  );
}
