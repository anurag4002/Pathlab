import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../../services/auditLogService';
import { PageHeader, DataTable, Input, Select, DatePicker, StatusBadge, Button, AdvancedFilterBar } from '../../components/common';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import formatDate from '../../utils/formatDate';

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
  const debouncedActor = useDebounce(actor, 500);
  const debouncedAction = useDebounce(action, 500);
  const { page, limit, goToPage, setLimit } = usePagination(1, 20);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });

  const fetchLogs = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await getAuditLogs({
        actor: debouncedActor.trim() || undefined,
        action: debouncedAction.trim() || undefined,
        entity: module !== 'All' ? module : undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit,
      });
      if (res?.success) {
        setActivities(res.data?.logs || []);
        setPaginationInfo(res.data?.pagination || { total: 0, pages: 0 });
      } else {
        setLoadError('Unexpected response from the audit log.');
      }
    } catch (e) {
      console.error('Failed to load audit logs', e);
      setLoadError(e.response?.data?.message || 'Could not reach the audit log.');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedActor, debouncedAction, module, from, to, page, limit]);

  const clearAll = () => {
    setActor(''); setAction(''); setModule('All'); setFrom(''); setTo('');
    goToPage(1);
  };

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Append-only trail of who did what, when (read-only)" />
      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!(actor || action || module !== 'All' || from || to)}
        onClear={clearAll}
        values={{ actor, action, module, from, to }}
        onChange={(key, value) => {
          goToPage(1);
          if (key === 'actor') setActor(value);
          else if (key === 'action') setAction(value);
          else if (key === 'module') setModule(value);
          else if (key === 'from') setFrom(value);
          else if (key === 'to') setTo(value);
        }}
        fields={[
          { key: 'actor', label: 'Actor', type: 'text', placeholder: 'User name…' },
          { key: 'action', label: 'Action', type: 'text', placeholder: 'e.g. Void Bill' },
          { key: 'module', label: 'Module', type: 'select', options: MODULES.map((m) => ({ value: m, label: m })), placeholder: '', size: 'sm' },
          { key: 'from', label: 'From', type: 'date' },
          { key: 'to', label: 'To', type: 'date' }
        ]}
      />
      {loadError && <p className="form-error" style={{ marginBottom: '1rem' }}>{loadError}</p>}
      <DataTable
        headers={['Timestamp', 'Actor', 'Role', 'Action', 'Entity / Module', 'Details']}
        data={activities}
        loading={loading}
        emptyMessage={loadError ? 'No audit data — the audit log is unreachable.' : 'No audit entries match these filters.'}
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit,
        }}
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
        {paginationInfo.total} entries · append-only (no edit/delete actions).
      </p>
    </div>
  );
};

export default AuditLog;
