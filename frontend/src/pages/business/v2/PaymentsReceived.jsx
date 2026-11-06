import React, { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { getTransactions } from '../../../services/transactionService';
import { getDailyBusiness } from '../../../services/dashboardService';
import { PageHeader, Button, StatGroup } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport, { fetchAllPages } from '../../../utils/printReport';
import { money, dateTimeLabel, periodLabel, sum, downloadCsv } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import './businessPages.css';

const modeClass = (mode) => `biz-pill is-${String(mode || '').toLowerCase()}`;
const modeOf = (t) => t.paymentMethod || 'Other';

// Payments received (new look): every payment and refund in a period, with
// totals per payment mode. Replaces the classic Cashbook screen.
export default function PaymentsReceived() {
  const [[from, to], setRange] = useState(() => presetRange('today'));
  const [all, setAll] = useState([]);
  const [ledgerIncome, setLedgerIncome] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('');
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    Promise.allSettled([
      fetchAllPages(async (p, size) => {
        const res = await getTransactions({ startDate: from, endDate: to, page: p, limit: size });
        return { items: res?.data?.transactions || [], pages: res?.data?.pagination?.pages || 1 };
      }),
      getDailyBusiness(from, `${to}T23:59:59.999`),
    ]).then(([list, biz]) => {
      if (cancelled) return;
      if (list.status === 'fulfilled') setAll(list.value);
      else { setAll([]); setError('Could not load the payments for this period.'); }
      setLedgerIncome(biz.status === 'fulfilled' && biz.value?.success ? Number(biz.value.data?.totalIncome ?? NaN) : null);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, reload]);

  const modes = useMemo(() => [...new Set(['Cash', 'UPI', 'Card', ...all.map(modeOf)])], [all]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((t) => (!mode || modeOf(t) === mode)
      && (!kind || (kind === 'Refund' ? t.type === 'Refund' : t.type !== 'Refund'))
      && (!q || String(t.patient?.name || '').toLowerCase().includes(q) || String(t.bill?.billNumber || '').toLowerCase().includes(q)));
  }, [all, mode, kind, search]);

  const ins = rows.filter((t) => t.type !== 'Refund');
  const outs = rows.filter((t) => t.type === 'Refund');
  const received = sum(ins, (t) => t.amount);
  const refunded = sum(outs, (t) => t.amount);
  const byMode = modes.map((m) => ({ mode: m, amount: sum(ins.filter((t) => modeOf(t) === m), (t) => t.amount) })).filter((m) => m.amount > 0);

  // One plain warning only if the payments truly disagree with the day's
  // money figures (no filters applied).
  const allIn = sum(all.filter((t) => t.type !== 'Refund'), (t) => t.amount);
  const mismatch = !loading && ledgerIncome != null && Number.isFinite(ledgerIncome) && Math.abs(ledgerIncome - allIn) >= 1;

  const filters = [mode && `Mode: ${mode}`, kind && (kind === 'Refund' ? 'Refunds only' : 'Payments only'), search && `Search: ${search}`];
  const print = () => printReport({
    title: 'Payments received',
    period: periodLabel(from, to),
    filters,
    summary: [
      { label: 'Received', value: money(received) },
      { label: 'Refunded', value: money(refunded) },
      { label: 'Net', value: money(received - refunded) },
      { label: 'Entries', value: String(rows.length) },
    ],
    sections: [
      byMode.length > 1 && {
        title: 'By payment mode',
        columns: [{ label: 'Mode' }, { label: 'Received', align: 'right' }, { label: 'Refunded', align: 'right' }, { label: 'Net', align: 'right' }],
        rows: modes.map((m) => {
          const got = sum(ins.filter((t) => modeOf(t) === m), (t) => t.amount);
          const back = sum(outs.filter((t) => modeOf(t) === m), (t) => t.amount);
          return got || back ? [m, money(got), money(back), money(got - back)] : null;
        }).filter(Boolean),
      },
      {
        title: 'Entries',
        columns: [{ label: 'Time' }, { label: 'Bill no' }, { label: 'Patient' }, { label: 'Mode' }, { label: 'Received by' }, { label: 'In', align: 'right' }, { label: 'Out', align: 'right' }],
        rows: rows.map((t) => [dateTimeLabel(t.date || t.createdAt), t.bill?.billNumber || '', t.patient?.name || 'Walk-in', modeOf(t), t.receivedBy?.name || '', t.type === 'Refund' ? '' : money(t.amount), t.type === 'Refund' ? money(t.amount) : '']),
        totals: ['Total', '', '', '', '', money(received), money(refunded)],
        empty: 'No payments in this period.',
      },
    ],
  });

  const downloadRows = () => downloadCsv(`payments-${from}-to-${to}.csv`,
    ['Date and time', 'Bill no', 'Patient', 'Mode', 'Type', 'Received by', 'Amount'],
    rows.map((t) => [dateTimeLabel(t.date || t.createdAt), t.bill?.billNumber || '', t.patient?.name || 'Walk-in', modeOf(t), t.type === 'Refund' ? 'Refund' : 'Payment', t.receivedBy?.name || '', t.type === 'Refund' ? -Number(t.amount) : Number(t.amount)]));

  return (
    <div className="biz-page">
      <PageHeader
        title="Payments received"
        subtitle="Every payment and refund taken in a period, by payment mode."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[{ label: 'These payments (CSV)', onClick: downloadRows }]} />
          </div>
        }
      />

      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])}>
        <select aria-label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">All modes</option>
          {modes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select aria-label="Payments or refunds" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Payments and refunds</option>
          <option value="Payment">Payments only</option>
          <option value="Refund">Refunds only</option>
        </select>
        <div className="form-group biz-inline-search">
          <input type="search" data-page-search="" aria-label="Search patient or bill no" placeholder="Patient or bill no" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </PeriodBar>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}
      {mismatch && !error && (
        <div className="biz-warning" role="status">
          These payments add up to {money(allIn)}, but the daily summary shows {money(ledgerIncome)} received. Please check with the admin.
        </div>
      )}

      <StatGroup loading={loading} label="Payments summary" items={[
        { label: 'Received', value: money(received), hint: `${ins.length} payment${ins.length === 1 ? '' : 's'}` },
        { label: 'Refunded', value: money(refunded), hint: `${outs.length} refund${outs.length === 1 ? '' : 's'}`, tone: refunded > 0 ? 'warning' : undefined },
        { label: 'Net', value: money(received - refunded), hint: 'Received - refunded' },
        ...byMode.slice(0, 3).map((m) => ({ label: m.mode, value: money(m.amount), hint: 'Received' })),
      ]} />

      <ReportTable loading={loading} rows={rows} limit={50}
        empty={search || mode || kind ? 'No payments match these filters.' : 'No payments were taken in this period.'}
        columns={[
          { key: 'time', label: 'Time', render: (t) => <span className="muted">{dateTimeLabel(t.date || t.createdAt)}</span> },
          { key: 'bill', label: 'Bill no', render: (t) => <span className="strong">{t.bill?.billNumber || ''}</span> },
          { key: 'patient', label: 'Patient', render: (t) => t.patient?.name || 'Walk-in' },
          { key: 'mode', label: 'Mode', render: (t) => <span className={modeClass(modeOf(t))}>{modeOf(t)}</span> },
          { key: 'by', label: 'Received by', render: (t) => t.receivedBy?.name || <span className="muted">Not recorded</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (t) => (t.type === 'Refund' ? <span className="is-due">Refund - {money(t.amount)}</span> : <span className="strong">{money(t.amount)}</span>) },
        ]}
        totals={{ time: 'Total', patient: `${rows.length} entries`, amount: money(received - refunded) }} />
    </div>
  );
}
