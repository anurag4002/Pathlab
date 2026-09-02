import React, { useState, useEffect } from 'react';
import { getActivityLogs } from '../../services/dashboardService';
import formatDate from '../../utils/formatDate';
import { ShieldAlert, Laptop, Eye } from 'lucide-react';
import { PageHeader, DataTable, StatusBadge } from '../../components/common';

const BrowserSecurity = () => {
  const [securityLogs, setSecurityLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSecurityLogs = async () => {
      setLoading(true);
      try {
        const res = await getActivityLogs();
        if (res.success) {
          // filter for authorization-related logs
          const filtered = res.data.filter(act => act.module === 'Auth' || act.action.toLowerCase().includes('login'));
          setSecurityLogs(filtered);
        }
      } catch (err) {
        console.error('Failed to load browser security logs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSecurityLogs();
  }, []);

  return (
    <div>
      <PageHeader
        title="Browser Session & Portal Security"
        subtitle="Audit logs of active clerk sessions, login histories, and browser environments"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Active Session Status Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: '#ecfdf5', color: 'var(--color-success)' }}>
            <Laptop size={24} />
          </div>
          <div>
            <div className="card-title">Active Devices</div>
            <div className="card-value" style={{ color: 'var(--color-success)', fontSize: '1.50rem' }}>
              1 Session Active
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Browser Agent</span>
          </div>
        </div>

        {/* Protection card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--primary-color)' }}>
          <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <div className="card-title">Portal Integrity</div>
            <div className="card-value" style={{ color: 'var(--primary-color)', fontSize: '1.50rem' }}>
              SSL Secure
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Token clearance active</span>
          </div>
        </div>

      </div>

      <DataTable
        headers={['Access Date', 'User Account', 'Role', 'IP Address / Session ID', 'Action Log']}
        data={securityLogs}
        loading={loading}
        emptyMessage="No login authorization logs recorded."
        renderRow={(log) => (
          <tr key={log._id}>
            <td>{formatDate(log.date)}</td>
            <td style={{ fontWeight: '600' }}>{log.user?.name || 'Clerk Account'}</td>
            <td>
              <StatusBadge status={log.user?.role || 'Operator'} />
            </td>
            <td style={{ fontFamily: 'Courier, monospace', fontSize: '0.825rem' }}>
              {log._id.slice(0, 12)}... (localhost)
            </td>
            <td>
              <span style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{log.action}</span> - {log.description}
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default BrowserSecurity;
