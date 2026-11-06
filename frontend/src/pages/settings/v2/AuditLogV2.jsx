import React, { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { getAuditLogs } from '../../../services/auditLogService';
import { PageHeader, Button, StatGroup } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport, { fetchAllPages } from '../../../utils/printReport';
import { dateTimeLabel, periodLabel, downloadCsv } from '../../../utils/reportFormat';
import '../../../components/business/business.css';
import '../../manage/v2/manage.css';

const who = (a) => a.user?.name || 'System';
const PAST = { Create: 'Created', Update: 'Updated', Delete: 'Deleted', Submit: 'Submitted', Verify: 'Verified', Approve: 'Approved', Void: 'Cancelled', Cancel: 'Cancelled', Collect: 'Collected', Add: 'Added', Remove: 'Removed', Upload: 'Uploaded', Print: 'Printed', Send: 'Sent', Refund: 'Refunded', Reset: 'Reset', Restore: 'Restored', Export: 'Downloaded', Edit: 'Edited' };
// "Create Expense" -> "Created expense"; "Login" -> "Signed in".
export const plainAction = (action = '') => {
  const text = String(action).trim();
  if (/^log ?in$/i.test(text)) return 'Signed in';
  if (/^log ?out$/i.test(text)) return 'Signed out';
  const [first, ...rest] = text.split(/\s+/);
  const verb = PAST[first] || first;
  return [verb, ...rest.map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()))].join(' ');
};
const AREA = { Authentication: 'Sign-in', Cases: 'Bills & patients', Lab: 'Lab', Business: 'Money', Manage: 'Staff & settings', Settings: 'Settings' };
const areaLabel = (m) => AREA[m] || m || '';

// Audit log (new look): a permanent record of who did what, and when.
export default function AuditLogV2() {
  const [[from, to], setRange] = useState(() => presetRange('week'));
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [person, setPerson] = useState('');
  const [area, setArea] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    fetchAllPages(async (page, limit) => {
      const res = await getAuditLogs({ from: from || undefined, to: to || undefined, page, limit });
      return { items: res?.data?.logs || [], pages: res?.data?.pagination?.pages || 1 };
    }, { pageSize: 100 })
      .then((rows) => { if (!cancelled) setAll(rows); })
      .catch((err) => { if (!cancelled) { setAll([]); setError(err.response?.data?.message || 'Could not load the audit log.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, reload]);

  const people = [...new Set(all.map(who))].sort();
  const areas = [...new Set(all.map((a) => a.module).filter(Boolean))].sort();
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((a) => (!person || who(a) === person) && (!area || a.module === area)
      && (!q || `${a.action} ${a.module} ${who(a)} ${a.description}`.toLowerCase().includes(q)));
  }, [all, person, area, search]);
  const signIns = rows.filter((a) => /^log ?in$/i.test(String(a.action || '').trim())).length;

  const filters = [person && `Person: ${person}`, area && `Area: ${areaLabel(area)}`, search && `Search: ${search}`];
  const print = () => printReport({
    title: 'Audit log',
    period: periodLabel(from, to),
    filters,
    summary: [{ label: 'Entries', value: String(rows.length) }, { label: 'People', value: String(new Set(rows.map(who)).size) }, { label: 'Sign-ins', value: String(signIns) }],
    sections: [{
      columns: [{ label: 'When' }, { label: 'Who' }, { label: 'What' }, { label: 'Area' }, { label: 'Details' }],
      rows: rows.map((a) => [dateTimeLabel(a.date), who(a), plainAction(a.action), areaLabel(a.module), a.description || '']),
      empty: 'Nothing was recorded in this period.',
    }],
    note: 'Entries cannot be edited or deleted.',
  });
  const exportCsv = () => downloadCsv(`audit-log-${from}-${to}.csv`, ['When', 'Who', 'Role', 'What', 'Area', 'Details'],
    rows.map((a) => [dateTimeLabel(a.date), who(a), a.user?.role || '', plainAction(a.action), areaLabel(a.module), a.description || '']));

  return (
    <div className="biz-page">
      <PageHeader
        title="Audit log"
        subtitle="A permanent record of who did what, and when. Entries cannot be changed or deleted."
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
          {areas.map((m) => <option key={m} value={m}>{areaLabel(m)}</option>)}
        </select>
        <div className="form-group mg-hidden-search">
          <input type="search" data-page-search="" aria-label="Search the audit log" placeholder="What happened" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </PeriodBar>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} items={[
        { label: 'Entries', value: String(rows.length), hint: periodLabel(from, to) },
        { label: 'People', value: String(new Set(rows.map(who)).size), hint: 'Did something in this period' },
        { label: 'Sign-ins', value: String(signIns) },
      ]} />

      <ReportTable loading={loading} rows={rows} limit={100} rowKey={(a) => a._id} empty="Nothing was recorded in this period."
        columns={[
          { key: 'when', label: 'When', render: (a) => <span className="muted">{dateTimeLabel(a.date)}</span> },
          { key: 'who', label: 'Who', render: (a) => <><div className="strong">{who(a)}</div>{a.user?.role && <div className="muted">{a.user.role}</div>}</> },
          { key: 'what', label: 'What', render: (a) => plainAction(a.action) },
          { key: 'area', label: 'Area', render: (a) => (a.module ? <span className="biz-pill">{areaLabel(a.module)}</span> : null) },
          { key: 'details', label: 'Details', render: (a) => <span className="mg-sub" style={{ color: '#3f3f46', fontSize: '0.85rem' }}>{a.description}</span> },
        ]} />
    </div>
  );
}
