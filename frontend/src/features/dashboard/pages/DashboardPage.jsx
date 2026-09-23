import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSummary } from '../../../services/dashboardService';
import { getOnboarding } from '../../../services/setupService';
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

const OnboardingWidget = () => {
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    getOnboarding().then((res) => { if (res.success) setProgress(res.data); }).catch(() => {});
  }, []);
  if (!progress || (progress.percent ?? 0) >= 100) return null;
  return (
    <div className="dashboard-card" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong style={{ fontSize: '0.9rem' }}>Getting started — {progress.done}/{progress.total} done ({progress.percent}%)</strong>
        <Link to="/setup/onboarding" style={{ fontSize: '0.825rem', fontWeight: '600' }}>Continue setup</Link>
      </div>
      <div style={{ height: '8px', background: 'var(--color-border, #e2e8f0)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${progress.percent}%`, height: '100%', background: 'var(--color-primary, #2563eb)' }} />
      </div>
    </div>
  );
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
      if (res.success) setStats(res.data);
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
        <div style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      <OnboardingWidget />

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
