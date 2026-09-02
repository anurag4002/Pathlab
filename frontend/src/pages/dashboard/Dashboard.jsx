import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSummary } from '../../services/dashboardService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { QUICK_ACTIONS, RECENT_TRANSACTIONS_HEADERS } from '../../constants/dashboardConstants';
import useAuth from '../../hooks/useAuth';
import * as Icons from 'lucide-react';
import { StatCard, DataTable, PageHeader, StatusBadge } from '../../components/common';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await getSummary();
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      setError('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleActionClick = (path) => {
    navigate(path);
  };

  const renderActionIcon = (iconName, color = 'var(--primary-color)') => {
    const IconComponent = Icons[iconName];
    return IconComponent ? <IconComponent size={20} style={{ color }} /> : null;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Polished Compact Hero Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            {getGreeting()}, {user?.name || 'Doctor'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            Here's what's happening at Pure Path Lab today.
          </p>
        </div>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)', padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#ffffff' }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--border-radius-sm)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Row 1 KPI Grid: Primary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats?.todayRevenue || 0)}
          icon="IndianRupee"
          color="var(--color-success)"
          trend="↑ 12% from yesterday"
        />
        <StatCard
          title="Total Patients"
          value={stats?.totalPatients || 0}
          icon="Users"
          color="var(--primary-color)"
        />
        <StatCard
          title="Today's Bills"
          value={stats?.todayBills || 0}
          icon="Receipt"
          color="var(--color-warning)"
        />
        <StatCard
          title="Pending Payments"
          value={formatCurrency(stats?.pendingPayments || 0)}
          icon="Hourglass"
          color="var(--color-danger)"
        />
      </div>

      {/* Row 2 KPI Grid: Secondary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <StatCard
          title="Lab Tests Database"
          value={stats?.totalTests || 0}
          icon="FlaskConical"
          color="var(--color-info)"
        />
        <StatCard
          title="Total Cases Count"
          value={stats?.totalCasesCount || 0}
          icon="FolderOpen"
          color="#8b5cf6"
        />
      </div>

      {/* Row 3: Quick Actions & Ledger Summary split */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Quick Actions Action Cards */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 1.25rem 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Quick Actions
          </h3>
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(auto-fill, minmax(50px, 1fr))', gap: '8px' }}>
            {QUICK_ACTIONS.filter(action => !action.roles || action.roles.includes(user?.role)).map((action) => (
              <div
                key={action.label}
                onClick={() => handleActionClick(action.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  backgroundColor: '#ffffff',
                  transition: 'all 0.15s ease'
                }}
                className="quick-action-row"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-color)';
                  e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'var(--bg-main)', display: 'flex', alignItems: 'center' }}>
                    {renderActionIcon(action.icon, 'var(--primary-color)')}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--text-main)' }}>{action.label}</div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{action.description}</div>
                  </div>
                </div>
                <Icons.ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Ledger Collection Summary Polished Card */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 1.25rem 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Ledger Collection Summary
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: '1rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Cleared Collections</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--color-success)' }}>
                  {formatCurrency(stats?.paymentSummary?.cleared || 0)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Outstanding Balance</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--color-danger)' }}>
                  {formatCurrency(stats?.paymentSummary?.due || 0)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)' }}>Gross Ledger Total</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--text-main)' }}>
                  {formatCurrency(stats?.paymentSummary?.total || 0)}
                </strong>
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', padding: '10px 0', fontSize: '0.825rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={() => navigate('/business/daily')}
          >
            <span>View Detailed Ledger Reports</span>
            <Icons.ArrowRight size={14} />
          </button>
        </div>

      </div>

      {/* Row 4: Recent Financial Logs Ledger Table */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 1.25rem 0' }}>
          Recent Financial Logs
        </h3>
        <DataTable
          headers={RECENT_TRANSACTIONS_HEADERS}
          data={stats?.recentTransactions || []}
          emptyMessage="No financial transaction records logged yet."
          renderRow={(transaction) => (
            <tr key={transaction._id}>
              <td style={{ fontWeight: '600' }}>{transaction.patient?.name || 'Walk-in Patient'}</td>
              <td style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{transaction.patient?.registrationNumber || 'N/A'}</td>
              <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(transaction.amount)}</td>
              <td>
                <StatusBadge status={transaction.paymentMethod} />
              </td>
              <td style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{formatDate(transaction.date)}</td>
              <td>
                {transaction.bill && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: '600' }}
                    onClick={() => navigate(`/cases/bills?search=${transaction.bill?.billNumber}`)}
                  >
                    View Bill
                  </button>
                )}
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  );
};

export default Dashboard;
