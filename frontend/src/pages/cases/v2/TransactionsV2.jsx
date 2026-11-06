import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, RefreshCw } from 'lucide-react';
import { getTransactions } from '../../../services/transactionService';
import { PAYMENT_METHODS } from '../../../constants/billConstants';
import { PageHeader, Button, StatGroup, IdentityCell } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport, { fetchAllPages } from '../../../utils/printReport';
import { money, dateTimeLabel, periodLabel, sum, downloadCsv } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import './casesV2.css';

// Transactions (new look): every payment and refund in a period.
export default function TransactionsV2() {
  const [searchParams] = useSearchParams();
  const opened = searchParams.get('search') || '';
  // Opened from a bill for one patient: show all their dates, not just this week.
  const [[from, to], setRange] = useState(() => (opened ? ['', ''] : presetRange('week')));
  const [search, setSearch] = useState(opened);
  const [type, setType] = useState('');
  const [mode, setMode] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    fetchAllPages(async (page, limit) => {
      const res = await getTransactions({ startDate: from || undefined, endDate: to || undefined, type: type || undefined, paymentMethod: mode || undefined, page, limit });
      return { items: res?.data?.transactions || [], pages: res?.data?.pagination?.pages || 1 };
    }, { pageSize: 100 })
      .then((all) => { if (!cancelled) setRows(all); })
      .catch((err) => { if (!cancelled) setError(err?.response?.status === 403 ? 'You do not have permission to see payments.' : 'Could not load payments. Check the connection and try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, type, mode, reload]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) => `${t.patient?.name || ''} ${t.bill?.billNumber || ''} ${t.patient?.phone || ''}`.toLowerCase().includes(q));
  }, [rows, search]);
  const ins = shown.filter((t) => t.type !== 'Refund');
  const outs = shown.filter((t) => t.type === 'Refund');
  const received = sum(ins, (t) => t.amount);
  const refunded = sum(outs, (t) => t.amount);

  const columns = [{ label: 'Time' }, { label: 'Bill no' }, { label: 'Patient' }, { label: 'Type' }, { label: 'Mode' }, { label: 'Received by' }, { label: 'Amount', align: 'right' }];
  const asRow = (t) => [dateTimeLabel(t.date), t.bill?.billNumber || '', t.patient?.name || 'Walk-in', t.type === 'Refund' ? 'Refund' : 'Received', t.paymentMethod || '', t.receivedBy?.name || '', `${t.type === 'Refund' ? '-' : ''}${money(t.amount)}`];
  const print = () => printReport({
    title: 'Transactions',
    period: periodLabel(from, to),
    filters: [type && (type === 'Refund' ? 'Refunds only' : 'Payments only'), mode && `Mode: ${mode}`, search && `Search: ${search}`],
    summary: [{ label: 'Received', value: money(received) }, { label: 'Refunded', value: money(refunded) }, { label: 'Net', value: money(received - refunded) }, { label: 'Entries', value: String(shown.length) }],
    sections: [{ columns, rows: shown.map(asRow), totals: ['Total', '', '', '', '', '', money(received - refunded)], empty: 'No payments in this period.' }],
  });

  return (
    <div className="biz-page">
      <PageHeader
        title="Transactions"
        subtitle="Every payment and refund, with who took it and how it was paid."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[{ label: 'These payments (CSV)', onClick: () => downloadCsv(`transactions-${from || 'all'}-${to || 'dates'}.csv`, columns.map((c) => c.label), shown.map(asRow)) }]} />
          </div>
        }
      />

      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])}>
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Payments and refunds</option>
          <option value="Income">Payments only</option>
          <option value="Refund">Refunds only</option>
        </select>
        <select aria-label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">All modes</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="form-group cases-search-wrap">
          <input type="search" data-page-search="" aria-label="Search patient or bill no" placeholder="Patient or bill no" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </PeriodBar>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Received', value: money(received), hint: `${ins.length} payment${ins.length === 1 ? '' : 's'}` },
        { label: 'Refunded', value: money(refunded), hint: `${outs.length} refund${outs.length === 1 ? '' : 's'}`, tone: refunded > 0 ? 'warning' : undefined },
        { label: 'Net', value: money(received - refunded), hint: 'Received - refunded' },
      ]} />

      <ReportTable loading={loading} rows={shown} empty={search ? 'No payment matches your search.' : 'No payments in this period.'}
        columns={[
          { key: 'patient', label: 'Patient', render: (t) => <IdentityCell name={t.patient?.name || 'Walk-in'} meta={[t.bill?.billNumber && `Bill ${t.bill.billNumber}`, dateTimeLabel(t.date)]} /> },
          { key: 'type', label: 'Type', render: (t) => (t.type === 'Refund' ? <span className="cases-status is-warn">Refund</span> : <span className="cases-status is-done">Received</span>) },
          { key: 'mode', label: 'Mode', render: (t) => <span className={`biz-pill is-${String(t.paymentMethod || '').toLowerCase()}`}>{t.paymentMethod}</span> },
          { key: 'by', label: 'Received by', render: (t) => t.receivedBy?.name || <span className="muted">Unknown</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (t) => (t.type === 'Refund' ? <span className="is-due">- {money(t.amount)}</span> : <span className="strong">{money(t.amount)}</span>) },
        ]}
        totals={{ patient: 'Total', amount: money(received - refunded) }} />
    </div>
  );
}
