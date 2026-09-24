import React, { useState, useEffect } from 'react';
import { getActivityLogs } from '../../services/dashboardService';
import formatDate from '../../utils/formatDate';
import useClientPagination from '../../hooks/useClientPagination';
import { PageHeader, DataTable, StatusBadge } from '../../components/common';

const Activities = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = activities.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(a.action || '').toLowerCase().includes(q) ||
      String(a.module || '').toLowerCase().includes(q) ||
      String(a.user?.name || '').toLowerCase().includes(q) ||
      String(a.description || '').toLowerCase().includes(q);
  });
  const pg = useClientPagination(filtered, 15);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await getActivityLogs();
      if (res.success) {
        setActivities(res.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  return (
    <div>
      <PageHeader
        title="Audit Activity Logs"
        subtitle="Chronological clinical log trace of employee updates, billing changes, and configuration details"
      />

      <DataTable
        headers={['Timestamp', 'User Operator', 'Role', 'Action performed', 'Module', 'Log Details']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No system audit logs found."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); pg.reset(); }}
        searchPlaceholder="Search action, module, user…"
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(act) => (
          <tr key={act._id}>
            <td>{formatDate(act.date)}</td>
            <td style={{ fontWeight: '600' }}>{act.user?.name || 'System / Seed'}</td>
            <td>
              <StatusBadge status={act.user?.role || 'System'} />
            </td>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{act.action}</td>
            <td>{act.module}</td>
            <td style={{ fontSize: '0.825rem' }}>{act.description}</td>
          </tr>
        )}
      />
    </div>
  );
};

export default Activities;
