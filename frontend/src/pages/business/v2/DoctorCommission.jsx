import React, { useEffect, useMemo, useState } from 'react';
import useStickyState from '../../../utils/useStickyState';
import { Printer, RefreshCw } from 'lucide-react';
import { getReferralReport } from '../../../services/dashboardService';
import { PageHeader, Button, StatGroup, Modal } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport from '../../../utils/printReport';
import { money, dayLabel, periodLabel, sum, downloadCsv } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import './businessV2Pages.css';

const pct = (r) => `${Number(r.commissionPercentage) || 0}%`;

const statementSection = (r) => ({
  title: `${r.doctorName} - ${pct(r)} commission`,
  columns: [{ label: 'Date' }, { label: 'Bill no' }, { label: 'Patient' }, { label: 'Bill amount', align: 'right' }, { label: 'Commission', align: 'right' }],
  rows: (r.billsList || []).map((b) => [dayLabel(b.date), b.billNumber, b.patientName, money(b.amount), money(b.commissionAmount)]),
  totals: ['Total', '', `${(r.billsList || []).length} bills`, money(sum(r.billsList || [], (b) => b.amount)), money(sum(r.billsList || [], (b) => b.commissionAmount))],
  empty: 'No bills for this doctor in this period.',
});

// Doctor commission (new look): who referred patients, how much was billed
// and what each doctor is owed - with a statement per doctor.
export default function DoctorCommission() {
  const [[from, to], setRange] = useStickyState('range', () => presetRange('month'));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useStickyState('search', '');
  const [openKey, setOpenKey] = useStickyState('open', null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getReferralReport(from, to)
      .then((res) => { if (!cancelled) setRows(res?.success ? res.data || [] : []); })
      .catch(() => { if (!cancelled) { setRows([]); setError('Could not load the doctor commission for this period.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, reload]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? rows.filter((r) => `${r.doctorName} ${r.clinicHospital || ''} ${r.contact || ''}`.toLowerCase().includes(q)) : rows;
    return [...list].sort((a, b) => (Number(b.totalCommission) || 0) - (Number(a.totalCommission) || 0));
  }, [rows, search]);

  const bills = sum(shown, (r) => r.billsCount);
  const billed = sum(shown, (r) => r.totalBillsAmount);
  const commission = sum(shown, (r) => r.totalCommission);

  const printSummary = (withBills) => printReport({
    title: withBills ? 'Doctor commission - statements' : 'Doctor commission',
    period: periodLabel(from, to),
    filters: [search && `Search: ${search}`],
    summary: [
      { label: 'Doctors', value: String(shown.length) },
      { label: 'Bills', value: String(bills) },
      { label: 'Billed', value: money(billed) },
      { label: 'Commission', value: money(commission) },
    ],
    sections: [
      {
        title: 'Summary',
        columns: [{ label: 'Doctor' }, { label: 'Clinic / contact' }, { label: 'Bills', align: 'right' }, { label: 'Commission %', align: 'right' }, { label: 'Billed', align: 'right' }, { label: 'Commission', align: 'right' }],
        rows: shown.map((r) => [r.doctorName, r.clinicHospital || r.contact || '', String(r.billsCount ?? 0), pct(r), money(r.totalBillsAmount), money(r.totalCommission)]),
        totals: ['Total', '', String(bills), '', money(billed), money(commission)],
        empty: 'No referred bills in this period.',
      },
      ...(withBills ? shown.map(statementSection) : []),
    ],
  });

  const printStatement = (r) => printReport({
    title: `Commission statement - ${r.doctorName}`,
    period: periodLabel(from, to),
    filters: [r.clinicHospital, r.contact].filter(Boolean),
    summary: [
      { label: 'Bills', value: String((r.billsList || []).length) },
      { label: 'Billed', value: money(r.totalBillsAmount) },
      { label: 'Commission rate', value: pct(r) },
      { label: 'Commission', value: money(r.totalCommission) },
    ],
    sections: [statementSection(r)],
  });

  const exportCsv = () => downloadCsv(`doctor-commission-${from}-${to}.csv`,
    ['Doctor', 'Clinic', 'Contact', 'Bills', 'Commission %', 'Billed', 'Commission'],
    shown.map((r) => [r.doctorName, r.clinicHospital || '', r.contact || '', r.billsCount ?? 0, Number(r.commissionPercentage) || 0, r.totalBillsAmount, r.totalCommission]));

  const exportBillsCsv = () => downloadCsv(`doctor-commission-bills-${from}-${to}.csv`,
    ['Doctor', 'Date', 'Bill no', 'Patient', 'Bill amount', 'Commission'],
    shown.flatMap((r) => (r.billsList || []).map((b) => [r.doctorName, dayLabel(b.date), b.billNumber, b.patientName, b.amount, b.commissionAmount])));

  const open = openKey ? (shown.find((r) => (r.doctorId || r.doctorName) === openKey) || null) : null;
  return (
    <div className="biz-page">
      <PageHeader
        title="Doctor commission"
        subtitle="Bills each doctor referred and the commission they are owed."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={() => printSummary(false)} disabled={loading}>Print</Button>
            <Button variant="secondary" size="sm" onClick={() => printSummary(true)} disabled={loading}>Print with bills</Button>
            <DownloadMenu items={[
              { label: 'Commission by doctor (CSV)', onClick: exportCsv },
              { label: 'Every referred bill (CSV)', onClick: exportBillsCsv },
            ]} />
          </div>
        }
      />

      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])}>
        <div className="form-group biz-search">
          <input type="search" data-page-search="" aria-label="Search doctor" placeholder="Doctor or clinic" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </PeriodBar>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Doctors', value: String(shown.length), hint: 'Who referred patients' },
        { label: 'Bills', value: String(bills), hint: 'Referred bills' },
        { label: 'Billed', value: money(billed), hint: 'On referred bills' },
        { label: 'Commission', value: money(commission), hint: 'Owed to doctors', tone: commission > 0 ? 'warning' : undefined },
      ]} />

      <section className="biz-section">
        <div className="biz-section-head"><h2>By doctor</h2><p>Click a doctor to see their bills and print a statement.</p></div>
        <ReportTable loading={loading} rows={shown} rowKey={(r) => r.doctorId || r.doctorName} onRowClick={(r) => setOpenKey(r.doctorId || r.doctorName)}
          empty="No doctor referred a patient in this period."
          columns={[
            { key: 'doctor', label: 'Doctor', render: (r) => <><div className="strong">{r.doctorName}</div><div className="muted">{r.clinicHospital || r.contact || 'No clinic added'}</div></> },
            { key: 'bills', label: 'Bills', align: 'right', render: (r) => r.billsCount ?? 0 },
            { key: 'rate', label: 'Commission %', align: 'right', render: pct },
            { key: 'billed', label: 'Billed', align: 'right', render: (r) => money(r.totalBillsAmount) },
            { key: 'commission', label: 'Commission', align: 'right', render: (r) => <span className="strong">{money(r.totalCommission)}</span> },
          ]}
          totals={{ doctor: 'Total', bills: String(bills), billed: money(billed), commission: money(commission) }} />
      </section>

      <Modal isOpen={!!open} onClose={() => setOpenKey(null)} variant="drawer" size="lg"
        title={open ? open.doctorName : ''}
        footer={open && <>
          <span className="bill-drawer-note">{periodLabel(from, to)}</span>
          <Button variant="primary" icon={<Printer size={14} />} onClick={() => printStatement(open)}>Print statement</Button>
        </>}>
        {open && (
          <div className="biz-drawer">
            <div className="biz-drawer-facts">
              <div><span>Clinic</span><b>{open.clinicHospital || 'Not added'}</b></div>
              <div><span>Contact</span><b>{open.contact || 'Not added'}</b></div>
              <div><span>Commission rate</span><b>{pct(open)}</b></div>
              <div><span>Commission</span><b>{money(open.totalCommission)}</b></div>
            </div>
            <ReportTable rows={open.billsList || []} rowKey={(b, i) => `${b.billNumber}-${i}`} empty="No bills for this doctor in this period."
              columns={[
                { key: 'date', label: 'Date', render: (b) => dayLabel(b.date) },
                { key: 'bill', label: 'Bill no', render: (b) => <span className="strong">{b.billNumber}</span> },
                { key: 'patient', label: 'Patient', render: (b) => b.patientName },
                { key: 'amount', label: 'Bill amount', align: 'right', render: (b) => money(b.amount) },
                { key: 'commission', label: 'Commission', align: 'right', render: (b) => money(b.commissionAmount) },
              ]}
              totals={{ date: 'Total', patient: `${(open.billsList || []).length} bills`, amount: money(sum(open.billsList || [], (b) => b.amount)), commission: money(sum(open.billsList || [], (b) => b.commissionAmount)) }} />
          </div>
        )}
      </Modal>
    </div>
  );
}
