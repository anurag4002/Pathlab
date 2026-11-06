import React, { useEffect, useMemo, useState } from 'react';
import useStickyState from '../../../utils/useStickyState';
import { RefreshCw } from 'lucide-react';
import { getMyCases } from '../../../services/doctorPortalService';
import { PageHeader, Button, StatGroup, IdentityCell, StatusBadge } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import ReportTable from '../../../components/business/ReportTable';
import { money, dayLabel } from '../../../utils/reportFormat';
import '../../../components/business/business.css';

const patientOf = (row) => (row.patient && typeof row.patient === 'object' ? row.patient : { name: row.patientName || row.patient || '' });
const dayOf = (row) => String(row.date || row.createdAt || '').slice(0, 10);

// What the doctor wants to know: who they sent, what was done, and whether
// the report is ready.
const statusText = (row) => {
  if (row.kind === 'Lab') return 'Registered';
  return row.status === 'Completed' ? 'Report ready' : 'In progress';
};

// Doctor portal (new look): one simple list of the patients this doctor
// referred - lab, USG and X-ray together - for a period.
export default function DoctorPortalV2() {
  const [data, setData] = useState({ bills: [], usg: [], xray: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [[from, to], setRange] = useStickyState('range', () => presetRange('days30'));
  const [kind, setKind] = useStickyState('kind', 'all');
  const [search, setSearch] = useStickyState('search', '');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getMyCases()
      .then((r) => { if (!cancelled && r?.success) setData({ bills: r.data?.bills || [], usg: r.data?.usg || [], xray: r.data?.xray || [] }); })
      .catch(() => { if (!cancelled) setError('Could not load your patients. Try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const all = useMemo(() => [
    ...data.bills.map((b) => ({ ...b, kind: 'Lab', what: 'Lab tests' })),
    ...data.usg.map((u) => ({ ...u, kind: 'USG', what: u.templateName || u.procedure || 'Ultrasound' })),
    ...data.xray.map((x) => ({ ...x, kind: 'X-ray', what: x.procedure || 'X-ray' })),
  ].sort((a, b) => dayOf(b).localeCompare(dayOf(a))), [data]);

  const inPeriod = all.filter((r) => { const d = dayOf(r); return (!from || d >= from) && (!to || d <= to); });
  const q = search.trim().toLowerCase();
  const rows = inPeriod.filter((r) => (kind === 'all' || r.kind === kind)
    && (!q || `${patientOf(r).name} ${patientOf(r).registrationNumber || ''} ${r.what}`.toLowerCase().includes(q)));
  const patients = new Set(inPeriod.map((r) => patientOf(r)._id || patientOf(r).name)).size;
  const ready = inPeriod.filter((r) => r.kind !== 'Lab' && r.status === 'Completed').length;
  const count = (k) => inPeriod.filter((r) => r.kind === k).length;

  const TABS = [
    { key: 'all', label: 'All', n: inPeriod.length },
    { key: 'Lab', label: 'Lab', n: count('Lab') },
    { key: 'USG', label: 'USG', n: count('USG') },
    { key: 'X-ray', label: 'X-ray', n: count('X-ray') },
  ];

  return (
    <div className="biz-page">
      <PageHeader
        title="My patients"
        subtitle="Patients you referred to the lab, what was done for them and whether the report is ready."
        action={<Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>}
      />

      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])} presets={['today', 'week', 'days30', 'month', 'lastMonth']}>
        <div className="form-group" style={{ margin: 0 }}>
          <input type="search" data-page-search="" aria-label="Search patient" placeholder="Patient name or reg no" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </PeriodBar>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Patients', value: String(patients), hint: 'Referred in this period' },
        { label: 'Lab visits', value: String(count('Lab')) },
        { label: 'USG', value: String(count('USG')) },
        { label: 'X-ray', value: String(count('X-ray')) },
        { label: 'Reports ready', value: String(ready), hint: 'USG and X-ray', tone: ready ? 'good' : undefined },
      ]} />

      <section className="biz-section">
        <div className="biz-tabs" role="tablist" aria-label="Kind">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={kind === t.key} className={kind === t.key ? 'is-on' : ''} onClick={() => setKind(t.key)}>
              {t.label}<span>{t.n}</span>
            </button>
          ))}
        </div>
        <ReportTable loading={loading} rows={rows} rowKey={(r, i) => `${r.kind}-${r._id || i}`}
          empty={q ? 'No patient matches your search.' : 'No referred patients in this period.'}
          columns={[
            { key: 'date', label: 'Date', render: (r) => <span className="muted">{dayLabel(dayOf(r))}</span> },
            { key: 'patient', label: 'Patient', render: (r) => { const p = patientOf(r); return <IdentityCell name={[p.title, p.name].filter(Boolean).join(' ') || 'Patient'} clinical={{ age: p.age, ageUnit: p.ageUnit, gender: p.gender }} meta={[p.registrationNumber && `Reg ${p.registrationNumber}`]} />; } },
            { key: 'what', label: 'For', render: (r) => <><div className="strong">{r.kind}</div><div className="muted">{r.what}</div></> },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => (r.kind === 'Lab' && r.totalAmount != null ? money(r.totalAmount) : <span className="muted">-</span>) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={statusText(r)} /> },
          ]} />
      </section>
    </div>
  );
}
