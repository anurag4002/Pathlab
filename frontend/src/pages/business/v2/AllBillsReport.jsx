import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Printer, RefreshCw } from 'lucide-react';
import { getBills } from '../../../services/billService';
import { PageHeader, Button, StatGroup, StatusBadge } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport, { fetchAllPages } from '../../../utils/printReport';
import { caseTypeLabel, money, dayLabel, periodLabel, sum, downloadCsv } from '../../../utils/reportFormat';
import useDebounce from '../../../hooks/useDebounce';
import { notify } from '../../../components/common/Toast/toast';
import '../../../components/business/business.css';
import './businessV2Pages.css';

const CASE_TYPES = ['LabCase', 'UsgCase', 'DigitalXrayCase', 'XrayCase', 'OutsourceLabCase', 'EcgCase', 'CtScanCase', 'MriCase', 'EpsCase', 'OpgCase', 'CardiologyCase', 'EegCase', 'MammographyCase'];
const STATUSES = [
  { value: '', label: 'Any payment' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Partial', label: 'Part paid' },
  { value: 'Pending', label: 'Not paid' },
];
const isCancelled = (b) => !!(b.isVoided || b.cancelled);
const statusOf = (b) => (isCancelled(b) ? 'Cancelled' : b.paymentStatus || '');

// Compact "Type" picker: one button, a short checklist underneath.
function TypePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const esc = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const toggle = (t) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const label = value.length === 0 ? 'All types' : value.length <= 2 ? value.map(caseTypeLabel).join(', ') : `${value.length} types`;
  return (
    <div className="biz-typepicker" ref={ref}>
      <button type="button" className="biz-typepicker-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label} <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="biz-typepicker-menu" role="group" aria-label="Case types">
          {CASE_TYPES.map((t) => (
            <label key={t}><input type="checkbox" checked={value.includes(t)} onChange={() => toggle(t)} /> {caseTypeLabel(t)}</label>
          ))}
          {value.length > 0 && <button type="button" className="biz-typepicker-clear" onClick={() => onChange([])}>Show all types</button>}
        </div>
      )}
    </div>
  );
}

// All bills report (new look): every bill in a period, with what was
// received and what is still to collect.
export default function AllBillsReport() {
  const [[from, to], setRange] = useState(() => presetRange('month'));
  const [types, setTypes] = useState([]);
  const [status, setStatus] = useState('');
  const [withCancelled, setWithCancelled] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    fetchAllPages(async (p, size) => {
      const res = await getBills({
        search: debouncedSearch || undefined,
        startDate: from || undefined,
        endDate: to || undefined,
        caseType: types.length ? types.join(',') : undefined,
        excludeCancelled: withCancelled ? undefined : 'true',
        page: p, limit: size,
      });
      return { items: res?.data?.bills || [], pages: res?.data?.pagination?.pages || 1 };
    })
      .then((list) => { if (!cancelled) setBills(list); })
      .catch(() => { if (!cancelled) { setBills([]); setError('Could not load the bills for this period.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, types.join(','), withCancelled, debouncedSearch, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (status ? bills.filter((b) => !isCancelled(b) && b.paymentStatus === status) : bills), [bills, status]);
  const live = rows.filter((b) => !isCancelled(b));
  const billed = sum(live, (b) => b.totalAmount);
  const received = sum(live, (b) => b.paidAmount);
  const toCollect = sum(live, (b) => b.dueAmount);

  const filtersText = [
    types.length ? types.map(caseTypeLabel).join(', ') : 'All case types',
    status && STATUSES.find((s) => s.value === status)?.label,
    withCancelled ? 'Cancelled bills included' : 'Cancelled bills left out',
    debouncedSearch && `Search: ${debouncedSearch}`,
  ];

  const print = async () => {
    try {
      await printReport({
        title: 'All bills report',
        period: periodLabel(from, to),
        filters: filtersText,
        summary: [
          { label: 'Bills', value: String(live.length) },
          { label: 'Billed', value: money(billed) },
          { label: 'Received', value: money(received) },
          { label: 'Still to collect', value: money(toCollect) },
        ],
        sections: [{
          columns: [{ label: 'Bill no' }, { label: 'Patient' }, { label: 'Type' }, { label: 'Referred by' }, { label: 'Date' }, { label: 'Amount', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Status' }],
          rows: rows.map((b) => [b.billNumber, [b.patient?.name || 'Walk-in', b.patient?.registrationNumber].filter(Boolean).join(' · '), caseTypeLabel(b.caseType), b.referringDoctor?.name || 'Self', dayLabel(b.date), money(b.totalAmount), money(b.paidAmount), statusOf(b)]),
          totals: ['Total', `${live.length} bills`, '', '', '', money(billed), money(received), ''],
          empty: 'No bills for these filters.',
        }],
      });
    } catch { notify('Could not prepare the print. Try again.'); }
  };

  const exportCsv = () => downloadCsv(`all-bills-${from || 'all'}-${to || 'dates'}.csv`,
    ['Bill no', 'Reg no', 'Patient', 'Type', 'Centre', 'Referred by', 'Date', 'Amount', 'Received', 'Still to collect', 'Status'],
    rows.map((b) => [b.billNumber, b.patient?.registrationNumber || '', b.patient?.name || '', caseTypeLabel(b.caseType), b.collectionCentre || 'Main', b.referringDoctor?.name || 'Self', dayLabel(b.date), b.totalAmount, b.paidAmount, b.dueAmount, statusOf(b)]));

  return (
    <div className="biz-page">
      <PageHeader
        title="All bills report"
        subtitle="Every bill in a period - what was billed, received and is still to collect."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[{ label: 'These bills (CSV)', onClick: exportCsv }]} />
          </div>
        }
      />

      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])}>
        <TypePicker value={types} onChange={setTypes} />
        <select aria-label="Payment" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label className="biz-check"><input type="checkbox" checked={withCancelled} onChange={(e) => setWithCancelled(e.target.checked)} /> Show cancelled</label>
        <div className="form-group biz-search">
          <input type="search" data-page-search="" aria-label="Search bills" placeholder="Bill no or patient" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </PeriodBar>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Bills', value: String(live.length), hint: withCancelled && rows.length > live.length ? `${rows.length - live.length} cancelled not counted` : 'In this period' },
        { label: 'Billed', value: money(billed) },
        { label: 'Received', value: money(received) },
        { label: 'Still to collect', value: money(toCollect), tone: toCollect > 0 ? 'warning' : undefined, to: toCollect > 0 ? '/business/dues' : undefined },
      ]} />

      <ReportTable loading={loading} rows={rows} empty="No bills for these filters."
        columns={[
          { key: 'bill', label: 'Bill no', render: (b) => <span className="strong">{b.billNumber}</span> },
          { key: 'patient', label: 'Patient', render: (b) => <><div>{b.patient?.name || 'Walk-in'}</div><div className="muted">{b.patient?.registrationNumber}</div></> },
          { key: 'type', label: 'Type', render: (b) => caseTypeLabel(b.caseType) },
          { key: 'doctor', label: 'Referred by', render: (b) => b.referringDoctor?.name || <span className="muted">Self</span> },
          { key: 'date', label: 'Date', render: (b) => <span className="muted">{dayLabel(b.date)}</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (b) => <span className="strong">{money(b.totalAmount)}</span> },
          { key: 'paid', label: 'Received', align: 'right', render: (b) => money(b.paidAmount) },
          { key: 'status', label: 'Status', render: (b) => <StatusBadge status={statusOf(b)} /> },
        ]}
        totals={{ bill: 'Total', patient: `${live.length} bills`, amount: money(billed), paid: money(received) }} />
    </div>
  );
}
