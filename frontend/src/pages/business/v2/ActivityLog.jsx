import React, { useEffect, useMemo, useState } from 'react';
import useStickyState from '../../../utils/useStickyState';
import { Printer, RefreshCw } from 'lucide-react';
import { getActivityLogs } from '../../../services/dashboardService';
import { PageHeader, Button } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport from '../../../utils/printReport';
import { dateTimeLabel, periodLabel, downloadCsv } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import './businessV2Pages.css';

const localDay = (value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA'); };
const who = (a) => a.user?.name || 'System';

// Activity log (new look): who did what, and when.
export default function ActivityLog() {
  const [[from, to], setRange] = useStickyState('range', () => presetRange('week'));
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [person, setPerson] = useStickyState('person', '');
  const [area, setArea] = useStickyState('area', '');
  const [search, setSearch] = useStickyState('search', '');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getActivityLogs()
      .then((res) => { if (!cancelled) setAll(res?.success ? res.data || [] : []); })
      .catch(() => { if (!cancelled) { setAll([]); setError('Could not load the activity log.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const inPeriod = useMemo(() => all.filter((a) => { const d = localDay(a.date); return (!from || d >= from) && (!to || d <= to); }), [all, from, to]);
  const people = [...new Set(inPeriod.map(who))].sort();
  const areas = [...new Set(inPeriod.map((a) => a.module).filter(Boolean))].sort();
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inPeriod.filter((a) => (!person || who(a) === person) && (!area || a.module === area)
      && (!q || `${a.action} ${a.module} ${who(a)} ${a.description}`.toLowerCase().includes(q)));
  }, [inPeriod, person, area, search]);

  const filters = [person && `Person: ${person}`, area && `Area: ${area}`, search && `Search: ${search}`];
  const print = () => printReport({
    title: 'Activity log',
    period: periodLabel(from, to),
    filters,
    summary: [{ label: 'Entries', value: String(rows.length) }, { label: 'People', value: String(new Set(rows.map(who)).size) }],
    sections: [{
      columns: [{ label: 'When' }, { label: 'Who' }, { label: 'What' }, { label: 'Area' }, { label: 'Details' }],
      rows: rows.map((a) => [dateTimeLabel(a.date), who(a), a.action || '', a.module || '', a.description || '']),
      empty: 'Nothing was recorded in this period.',
    }],
  });
  const exportCsv = () => downloadCsv(`activity-log-${from}-${to}.csv`, ['When', 'Who', 'Role', 'What', 'Area', 'Details'],
    rows.map((a) => [dateTimeLabel(a.date), who(a), a.user?.role || '', a.action || '', a.module || '', a.description || '']));

  return (
    <div className="biz-page">
      <PageHeader
        title="Activity log"
        subtitle="Who did what, and when - bills, payments, results and settings."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[{ label: 'This list (CSV)', onClick: exportCsv }]} />
          </div>
        }
      />
      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])}>
        <select aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Everyone</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">All areas</option>
          {areas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="form-group biz-search">
          <input type="search" data-page-search="" aria-label="Search activity" placeholder="What happened" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </PeriodBar>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <ReportTable loading={loading} rows={rows} limit={100} empty="Nothing was recorded in this period."
        columns={[
          { key: 'when', label: 'When', render: (a) => <span className="muted">{dateTimeLabel(a.date)}</span> },
          { key: 'who', label: 'Who', render: (a) => <><div className="strong">{who(a)}</div>{a.user?.role && <div className="muted">{a.user.role}</div>}</> },
          { key: 'what', label: 'What', render: (a) => a.action },
          { key: 'area', label: 'Area', render: (a) => (a.module ? <span className="biz-pill">{a.module}</span> : null) },
          { key: 'details', label: 'Details', className: 'biz-wrap', render: (a) => a.description },
        ]} />
    </div>
  );
}
