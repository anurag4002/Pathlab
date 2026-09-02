import React, { useState, useEffect } from 'react';
import { getActivityLogs } from '../../services/dashboardService';
import formatDate from '../../utils/formatDate';
import { PageHeader, DataTable, StatusBadge } from '../../components/common';

const Activities = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

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
        data={activities}
        loading={loading}
        emptyMessage="No system audit logs found."
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
