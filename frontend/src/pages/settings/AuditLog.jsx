import React, { useState, useEffect, useMemo } from 'react';
import { getActivityLogs } from '../../services/dashboardService';
import { PageHeader, DataTable, Input, Select, DatePicker, StatusBadge } from '../../components/common';
import formatDate from '../../utils/formatDate';

// Phase 20 — Audit log viewer (Admin).
// No dedicated audit-log API exists; this screen reads the Activity
// collection via the existing GET /dashboard/activities endpoint and
// filters client-side. It never fakes server data: when the endpoint is
// unreachable the table shows an error + pending-API banner.
const MODULES = ['All', 'Cases', 'Manage', 'Settings', 'Authentication'];

const AuditLog = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [module, setModule] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await getActivityLogs();
      if (res?.success) {
        setActivities(Array.isArray(res.data) ? res.data : []);
      } else {
        setLoadError('Unexpected response from the activity feed.');
      }
    } catch (e) {
      console.error('Failed to load audit logs', e);
      setLoadError(e.response?.data?.message || 'Could not reach the activity feed.');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = useMemo(() => activities.filter((a) => {
    if (actor.trim()) {
      const q = actor.toLowerCase();
      const name = (a.user?.name || '').toLowerCase();
      if (!name.includes(q)) return false;
    }
    if (action.trim() && !(a.action || '').toLowerCase().includes(action.toLowerCase())) return false;
    if (module !== 'All' && a.module !== module) return false;
    if (from && new Date(a.date) < new Date(from)) return false;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (new Date(a.date) > end) return false;
    }
    return true;
  }), [activities, actor, action, module, from, to]);

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Append-only trail of who did what, when (read-only)" />
      <div className="card" style={{ padding: '10px 14px', marginBottom: '1rem', fontSize: '0.82rem', borderLeft: '4px solid var(--color-warning, #d97706)' }}>
        Server audit-log API pending — showing the local Activity feed via <code>GET /dashboard/activities</code>.
        No entries are fabricated; filters below apply client-side.
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
        <Input label="Actor" value={actor} onChange={(e) => setActor(e.target.value)} placeholder="User name..." style={{ minWidth: '160px' }} />
        <Input label="Action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Void Bill" style={{ minWidth: '160px' }} />
        <Select label="Module" value={module} onChange={(e) => setModule(e.target.value)} options={MODULES.map((m) => ({ value: m, label: m }))} style={{ minWidth: '150px' }} />
        <DatePicker label="From" value={from} onChange={(e) => setFrom(e.target.value)} style={{ marginBottom: 0 }} />
        <DatePicker label="To" value={to} onChange={(e) => setTo(e.target.value)} style={{ marginBottom: 0 }} />
        {(actor || action || module !== 'All' || from || to) && (
          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => { setActor(''); setAction(''); setModule('All'); setFrom(''); setTo(''); }}>
            Clear
          </button>
        )}
      </div>
      {loadError && <p className="form-error" style={{ marginBottom: '1rem' }}>{loadError}</p>}
      <DataTable
        headers={['Timestamp', 'Actor', 'Role', 'Action', 'Entity / Module', 'Details']}
        data={filtered}
        loading={loading}
        emptyMessage={loadError ? 'No audit data — the activity feed is unreachable.' : 'No audit entries match these filters.'}
        renderRow={(a) => (
          <tr key={a._id}>
            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.date)}</td>
            <td style={{ fontWeight: '600' }}>{a.user?.name || 'System'}</td>
            <td><StatusBadge status={a.user?.role || 'System'} /></td>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{a.action}</td>
            <td>{a.module}</td>
            <td style={{ fontSize: '0.825rem', maxWidth: '320px' }}>{a.description}</td>
          </tr>
        )}
      />
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
        {filtered.length} of {activities.length} entries · append-only (no edit/delete actions).
      </p>
    </div>
  );
};

export default AuditLog;
