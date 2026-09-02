import React, { useState, useEffect } from 'react';
import { getSummary } from '../../../services/dashboardService';
import useAuth from '../../../hooks/useAuth';
import { LoadingSpinner } from '../../../components/common';
import DashboardStats from '../components/DashboardStats';
import QuickActions from '../components/QuickActions';
import LedgerSummaryCard from '../components/LedgerSummaryCard';
import RecentTransactionsTable from '../components/RecentTransactionsTable';
import '../Dashboard.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const DashboardPage = () => {
  const { user } = useAuth();
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
      setError('Failed to load dashboard metrics. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Loading dashboard summary..." size={2.5} />;
  }

  const currentDateFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div>
      {/* Hero Welcome Header */}
      <div className="dashboard-hero">
        <div>
          <h1 className="dashboard-hero-title">
            {getGreeting()}, {user?.name || 'Doctor'}
          </h1>
          <p className="dashboard-hero-subtitle">
            Here is the operational overview for Pure Path Lab today.
          </p>
        </div>
        <div className="dashboard-date-badge">{currentDateFormatted}</div>
      </div>

      {error && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-4)'
          }}
        >
          {error}
        </div>
      )}

      {/* Primary & Secondary KPI Metrics */}
      <DashboardStats stats={stats} />

      {/* Quick Actions & Ledger Summary Split */}
      <div className="dashboard-split-grid">
        <QuickActions />
        <LedgerSummaryCard paymentSummary={stats?.paymentSummary} />
      </div>

      {/* Recent Activity Table */}
      <RecentTransactionsTable transactions={stats?.recentTransactions} />
    </div>
  );
};

export default DashboardPage;
