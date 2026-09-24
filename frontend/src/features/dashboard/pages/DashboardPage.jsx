import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import {
  getActivityLogs,
  getDailyBusiness,
  getMonthlyTrends,
  getSummary
} from '../../../services/dashboardService';
import { getPendingLabCases, getReports } from '../../../services/reportService';
import { getOnboarding } from '../../../services/setupService';
import { getSubscription } from '../../../services/supportService';
import useAuth from '../../../hooks/useAuth';
import {
  Button,
  DataTable,
  EmptyState,
  LoadingSpinner,
  StatusBadge
} from '../../../components/common';
import { SvgLine } from '../../../components/charts/SvgCharts';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';
import { formatReportTat } from '../../../utils/reportTat';
import DashboardStats from '../components/DashboardStats';
import QuickActions from '../components/QuickActions';
import LedgerSummaryCard from '../components/LedgerSummaryCard';
import RecentTransactionsTable from '../components/RecentTransactionsTable';
import '../Dashboard.css';

const hasValue = (value) =>
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));

const formatCount = (value) => (hasValue(value) ? String(value) : '—');
const formatMoney = (value) => (hasValue(value) ? formatCurrency(value) : '—');

const getApiErrorMessage = (error, fallback) => {
  if (error?.response) {
    const message = error.response.data?.message;
    if (typeof message === 'string' && message.trim()) return message;

    const status = error.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to view this dashboard section.';
    if (status === 404) return 'The requested dashboard record was not found.';
    if (status === 409) return 'The dashboard data changed elsewhere. Please refresh and try again.';
    if (status === 422) return 'The selected dashboard filter is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }

  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.request) return 'Network error. Please check your connection and try again.';
  return error?.message || fallback;
};

const DashboardErrorBanner = ({ message, onRetry }) => (
  <div
    role="alert"
    className="dashboard-error-banner"
  >
    <span>{message}</span>
    {onRetry && (
      <Button
        variant="secondary"
        size="sm"
        icon={<RefreshCw size={14} />}
        onClick={onRetry}
        style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
      >
        Retry
      </Button>
    )}
  </div>
);

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const OnboardingWidget = ({ refreshKey, onRefresh }) => {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getOnboarding().then((res) => {
      if (!active) return;
      if (res?.success) {
        setError(null);
        setProgress(res.data);
      } else {
        setError('The onboarding service returned an unsuccessful response.');
      }
    }).catch((requestError) => {
      if (active) setError(getApiErrorMessage(requestError, 'Failed to load onboarding progress.'));
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (error) {
    return <div className="dashboard-card"><DashboardErrorBanner message={error} onRetry={onRefresh} /></div>;
  }
  if (!progress || progress.percent === undefined || progress.percent === null || progress.percent >= 100) return null;
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

const TrialWidget = ({ refreshKey, onRefresh }) => {
  const [sub, setSub] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getSubscription().then((res) => {
      if (!active) return;
      if (res?.success) {
        setError(null);
        setSub(res.data?.subscription || null);
      } else {
        setError('The subscription service returned an unsuccessful response.');
      }
    }).catch((requestError) => {
      if (active) setError(getApiErrorMessage(requestError, 'Failed to load subscription status.'));
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (error) {
    return <div className="dashboard-card"><DashboardErrorBanner message={error} onRetry={onRefresh} /></div>;
  }
  if (!sub) return null;
  const plan = sub.plan || {};
  const capText = [
    plan.yearlyCaseCap !== undefined && plan.yearlyCaseCap !== null ? `${plan.yearlyCaseCap}/yr` : '',
    plan.dailyCourtesyCap !== undefined && plan.dailyCourtesyCap !== null ? `${plan.dailyCourtesyCap}/day` : ''
  ].filter(Boolean).join(', ');
  return (
    <div className="dashboard-card" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '0.875rem' }}>
          <strong>{plan.name || 'Trial'}</strong>
          {' · '}<span>{sub.status}</span>
          {sub.trialEndsAt && <span> · trial ends {new Date(sub.trialEndsAt).toLocaleDateString()}</span>}
          {capText && <span style={{ color: 'var(--color-text-muted, #64748b)' }}> · caps: {capText}</span>}
        </div>
        <Link to="/support/subscription" style={{ fontSize: '0.825rem', fontWeight: '600' }}>Manage subscription</Link>
      </div>
    </div>
  );
};

const BusinessOverview = ({ refreshKey, onRefresh }) => {
  const navigate = useNavigate();
  const [dailyState, setDailyState] = useState({ key: null, data: null, error: null });
  const [trendsState, setTrendsState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    let active = true;

    Promise.allSettled([getDailyBusiness(), getMonthlyTrends()]).then(([dailyResult, trendsResult]) => {
      if (!active) return;

      if (dailyResult.status === 'fulfilled' && dailyResult.value?.success) {
        setDailyState({ key: refreshKey, data: dailyResult.value.data, error: null });
      } else {
        setDailyState({
          key: refreshKey,
          data: null,
          error: getApiErrorMessage(
            dailyResult.status === 'rejected' ? dailyResult.reason : null,
            'Failed to load today’s business snapshot.'
          )
        });
      }

      if (trendsResult.status === 'fulfilled' && Array.isArray(trendsResult.value?.data)) {
        setTrendsState({ key: refreshKey, data: trendsResult.value.data, error: null });
      } else {
        setTrendsState({
          key: refreshKey,
          data: null,
          error: getApiErrorMessage(
            trendsResult.status === 'rejected' ? trendsResult.reason : null,
            'Failed to load the server monthly collection trend.'
          )
        });
      }
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const dailyLoading = dailyState.key !== refreshKey;
  const trendsLoading = trendsState.key !== refreshKey;
  const daily = dailyState.key === refreshKey ? dailyState.data : null;
  const trends = trendsState.key === refreshKey ? trendsState.data : null;
  const dailyError = dailyState.key === refreshKey ? dailyState.error : null;
  const trendsError = trendsState.key === refreshKey ? trendsState.error : null;

  const dailyRows = [
    ['Collections', daily?.totalIncome],
    ['Expenses', daily?.totalExpenses],
    ['Refunds', daily?.totalRefunds],
    ['Net income', daily?.netIncome]
  ];
  const trendData = (trends || []).map((item) => ({
    label: `${item.month} ${item.year}`,
    value: item.revenue
  }));

  return (
    <section className="dashboard-card">
      <div className="dashboard-widget-header">
        <div>
          <h2 className="dashboard-card-title">Business Snapshot</h2>
          <p className="dashboard-widget-description">Today’s server-provided collections and the available six-month collection trend.</p>
        </div>
        <div className="dashboard-widget-actions">
          <Button variant="secondary" size="sm" onClick={() => navigate('/business/daily')}>Daily</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/business/monthly')}>Monthly</Button>
        </div>
      </div>

      {dailyError && <DashboardErrorBanner message={dailyError} onRetry={onRefresh} />}
      {dailyLoading ? (
        <LoadingSpinner label="Loading today’s business..." />
      ) : daily ? (
        <div className="dashboard-inline-metrics">
          {dailyRows.map(([label, amount]) => (
            <div className="dashboard-inline-metric" key={label}>
              <span>{label}</span>
              <strong>{formatMoney(amount)}</strong>
            </div>
          ))}
        </div>
      ) : dailyError ? null : (
        <EmptyState title="No business data" message="The daily business API returned no report data." />
      )}

      <div className="dashboard-subheading">
        <h3>Six-month collection trend</h3>
        <span>Server values; not test revenue</span>
      </div>
      {trendsError && <DashboardErrorBanner message={trendsError} onRetry={onRefresh} />}
      {trendsLoading ? (
        <LoadingSpinner label="Loading collection trend..." />
      ) : trendData.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <SvgLine data={trendData} height={190} color="var(--color-primary)" />
        </div>
      ) : (
        <EmptyState title="No collection trend" message="The trend API returned no monthly collection points." />
      )}
    </section>
  );
};

const PendingWorkCard = ({ refreshKey, onRefresh, canVerify }) => {
  const [pendingState, setPendingState] = useState({ key: null, total: null, error: null });

  useEffect(() => {
    let active = true;

    getPendingLabCases({ page: 1, limit: 1 }).then((response) => {
      if (!active) return;
      if (response?.success && response.data?.pagination) {
        setPendingState({ key: refreshKey, total: response.data.pagination.total, error: null });
      } else {
        setPendingState({
          key: refreshKey,
          total: null,
          error: 'The pending result-entry service returned an unsuccessful response.'
        });
      }
    }).catch((requestError) => {
      if (active) {
        setPendingState({
          key: refreshKey,
          total: null,
          error: getApiErrorMessage(requestError, 'Failed to load pending result-entry cases.')
        });
      }
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const loading = pendingState.key !== refreshKey;
  const pendingTotal = pendingState.key === refreshKey ? pendingState.total : null;
  const error = pendingState.key === refreshKey ? pendingState.error : null;

  return (
    <section className="dashboard-card">
      <div className="dashboard-widget-header">
        <div>
          <h2 className="dashboard-card-title">Pending Lab Work</h2>
          <p className="dashboard-widget-description">Open existing queues; counts come only from the pending-cases API.</p>
        </div>
      </div>
      {error && <DashboardErrorBanner message={error} onRetry={onRefresh} />}
      <div className="dashboard-work-links">
        <Link className="dashboard-work-link" to="/lab/result-entry">
          <span>
            <strong>Result-entry queue</strong>
            <small>Pending lab cases</small>
          </span>
          <strong>{loading ? '—' : formatCount(pendingTotal)}</strong>
        </Link>
        {canVerify && (
          <Link className="dashboard-work-link" to="/lab/verification">
            <span>
              <strong>Verification queue</strong>
              <small>Open the existing review screen</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </section>
  );
};

const getReportTestNames = (report) => {
  const names = (Array.isArray(report?.results) ? report.results : [])
    .map((result) => result?.testName)
    .filter(Boolean);
  if (names.length > 0) return names.join(', ');
  return report?.test?.name || '—';
};

const RecentReportsCard = ({ refreshKey, onRefresh, canVerify }) => {
  const navigate = useNavigate();
  const [reportsState, setReportsState] = useState({ key: null, reports: [], error: null });

  useEffect(() => {
    let active = true;

    getReports({ page: 1, limit: 5 }).then((response) => {
      if (!active) return;
      if (response?.success && Array.isArray(response.data?.reports)) {
        setReportsState({ key: refreshKey, reports: response.data.reports, error: null });
      } else {
        setReportsState({
          key: refreshKey,
          reports: [],
          error: 'The report service returned an unsuccessful response.'
        });
      }
    }).catch((requestError) => {
      if (active) {
        setReportsState({
          key: refreshKey,
          reports: [],
          error: getApiErrorMessage(requestError, 'Failed to load recent reports.')
        });
      }
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const reports = reportsState.key === refreshKey ? reportsState.reports : [];
  const loading = reportsState.key !== refreshKey;
  const error = reportsState.key === refreshKey ? reportsState.error : null;

  return (
    <section className="dashboard-card">
      <div className="dashboard-widget-header">
        <div>
          <h2 className="dashboard-card-title">Latest Reports</h2>
          <p className="dashboard-widget-description">Latest report records with API status and TAT; no aggregate completion count is inferred.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(canVerify ? '/lab/verification' : '/lab/reports')}
        >
          Open queue
        </Button>
      </div>
      {error && <DashboardErrorBanner message={error} onRetry={onRefresh} />}
      {!error && (
        <DataTable
          className="dashboard-embedded-table"
          headers={['Report date', 'Tests', 'TAT', 'Status']}
          data={reports}
          loading={loading}
          emptyTitle="No recent reports"
          emptyMessage="The report API returned no records for the latest page."
          renderRow={(report) => (
            <tr key={report._id}>
              <td>{formatDate(report.reportDate)}</td>
              <td>{getReportTestNames(report)}</td>
              <td>{formatReportTat(report)}</td>
              <td>{report.status ? <StatusBadge status={report.status} /> : '—'}</td>
            </tr>
          )}
        />
      )}
    </section>
  );
};

const RecentActivityCard = ({ refreshKey, onRefresh }) => {
  const [activitiesState, setActivitiesState] = useState({ key: null, activities: [], error: null });

  useEffect(() => {
    let active = true;

    getActivityLogs().then((response) => {
      if (!active) return;
      if (response?.success && Array.isArray(response.data)) {
        setActivitiesState({ key: refreshKey, activities: response.data, error: null });
      } else {
        setActivitiesState({
          key: refreshKey,
          activities: [],
          error: 'The activity service returned an unsuccessful response.'
        });
      }
    }).catch((requestError) => {
      if (active) {
        setActivitiesState({
          key: refreshKey,
          activities: [],
          error: getApiErrorMessage(requestError, 'Failed to load recent activity.')
        });
      }
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const activities = activitiesState.key === refreshKey ? activitiesState.activities : [];
  const loading = activitiesState.key !== refreshKey;
  const error = activitiesState.key === refreshKey ? activitiesState.error : null;

  return (
    <section className="dashboard-card">
      <div className="dashboard-widget-header">
        <div>
          <h2 className="dashboard-card-title">Recent Activity</h2>
          <p className="dashboard-widget-description">Latest audit activity without patient or financial descriptions.</p>
        </div>
        <Link className="dashboard-text-link" to="/business/activities">View all</Link>
      </div>
      {error && <DashboardErrorBanner message={error} onRetry={onRefresh} />}
      {!error && (
        <DataTable
          className="dashboard-embedded-table"
          headers={['When', 'User', 'Action', 'Module']}
          data={activities.slice(0, 5)}
          loading={loading}
          emptyTitle="No recent activity"
          emptyMessage="The activity API returned no records."
          renderRow={(activity) => (
            <tr key={activity._id}>
              <td>{formatDate(activity.date)}</td>
              <td>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{activity.user?.name || '—'}</div>
                {activity.user?.role && <small style={{ color: 'var(--color-text-muted)' }}>{activity.user.role}</small>}
              </td>
              <td>{activity.action || '—'}</td>
              <td>{activity.module || '—'}</td>
            </tr>
          )}
        />
      )}
    </section>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();
  const role = user?.role;
  const canViewFinance = role === 'Admin' || role === 'Employee';
  const canViewBusiness = role === 'Admin';
  const canViewLabWork = role === 'Admin' || role === 'Employee';
  const canViewReports = role === 'Admin' || role === 'Employee';
  const canVerify = role === 'Admin';

  const [statsState, setStatsState] = useState({ key: null, data: null, error: null });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    getSummary().then((response) => {
      if (!active) return;
      if (response?.success && response.data && typeof response.data === 'object') {
        setStatsState({ key: refreshKey, data: response.data, error: null });
      } else {
        setStatsState({
          key: refreshKey,
          data: null,
          error: 'The dashboard summary service returned an unsuccessful response.'
        });
      }
    }).catch((error) => {
      if (active) {
        setStatsState({
          key: refreshKey,
          data: null,
          error: getApiErrorMessage(error, 'Failed to load dashboard metrics. Please refresh.')
        });
      }
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const stats = statsState.key === refreshKey ? statsState.data : null;
  const statsError = statsState.key === refreshKey ? statsState.error : null;
  const statsLoading = statsState.key !== refreshKey;

  const handleRefresh = () => {
    setRefreshKey((value) => value + 1);
  };
  const currentDateFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const greeting = getGreeting();
  const welcome = user?.name ? `${greeting}, ${user.name}` : greeting;

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <h1 className="dashboard-hero-title">{welcome}</h1>
          <p className="dashboard-hero-subtitle">
            Here is the operational overview for Pure Path Lab today.
          </p>
        </div>
        <div className="dashboard-date-controls">
          <div className="dashboard-date-badge">{currentDateFormatted}</div>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={handleRefresh}
            disabled={statsLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {statsError && <DashboardErrorBanner message={statsError} onRetry={handleRefresh} />}

      {role === 'Admin' && <OnboardingWidget refreshKey={refreshKey} onRefresh={handleRefresh} />}
      {role === 'Admin' && <TrialWidget refreshKey={refreshKey} onRefresh={handleRefresh} />}

      <DashboardStats
        stats={stats}
        canViewFinance={canViewFinance}
        loading={statsLoading}
      />

      <div className="dashboard-split-grid">
        <QuickActions />
        {canViewFinance && !statsError && (
          <LedgerSummaryCard
            paymentSummary={stats?.paymentSummary}
            loading={statsLoading}
          />
        )}
      </div>

      {(canViewBusiness || canViewLabWork) && (
        <div className="dashboard-section-grid">
          {canViewBusiness && <BusinessOverview refreshKey={refreshKey} onRefresh={handleRefresh} />}
          <PendingWorkCard refreshKey={refreshKey} onRefresh={handleRefresh} canVerify={canVerify} />
        </div>
      )}

      {canViewReports && <RecentReportsCard refreshKey={refreshKey} onRefresh={handleRefresh} canVerify={canVerify} />}

      {canViewFinance && !statsError && (
        <RecentTransactionsTable
          transactions={stats?.recentTransactions || []}
          loading={statsLoading}
        />
      )}

      {canViewBusiness && <RecentActivityCard refreshKey={refreshKey} onRefresh={handleRefresh} />}

      <p className="dashboard-footnote">
        Summary labels distinguish today’s metrics from all-time ledger values. Active test definitions and case records are catalog/summary counts, not tests performed. All-time case records follow the API’s Bill + USG + X-Ray scope; all-time due values may include voided bills. No missing API value is converted to zero.
      </p>
    </div>
  );
};

export default DashboardPage;
