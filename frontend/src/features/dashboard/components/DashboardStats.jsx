import React from 'react';
import { IndianRupee, Users, Receipt, Hourglass, FlaskConical, FolderOpen } from 'lucide-react';
import { StatCard } from '../../../components/common';
import formatCurrency from '../../../utils/formatCurrency';
import '../Dashboard.css';

const hasValue = (value) =>
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));

const formatCount = (value) => (hasValue(value) ? String(value) : '—');
const formatMoney = (value) => (hasValue(value) ? formatCurrency(value) : '—');

const DashboardStats = ({ stats, canViewFinance = false, loading = false }) => {
  const valueOrLoading = (value) => (loading ? '—' : value);

  return (
    <div className="dashboard-stats-grid" aria-busy={loading}>
      {canViewFinance && (
        <StatCard
          title="Today’s Collections"
          value={formatMoney(valueOrLoading(stats?.todayRevenue))}
          icon={IndianRupee}
          color="var(--color-success)"
          bgColor="var(--color-success-bg)"
        />
      )}

      <StatCard
        title="Today’s Bills"
        value={formatCount(valueOrLoading(stats?.todayBills))}
        icon={Receipt}
        color="var(--color-warning)"
        bgColor="var(--color-warning-bg)"
      />
      <StatCard
        title="Registered Patients"
        value={formatCount(valueOrLoading(stats?.totalPatients))}
        icon={Users}
        color="var(--color-primary)"
        bgColor="var(--color-primary-light)"
      />
      <StatCard
        title="Active Test Definitions"
        value={formatCount(valueOrLoading(stats?.totalTests))}
        icon={FlaskConical}
        color="var(--color-info)"
        bgColor="var(--color-info-bg)"
      />
      <StatCard
        title="All-time Case Records"
        value={formatCount(valueOrLoading(stats?.totalCasesCount))}
        icon={FolderOpen}
        color="#8b5cf6"
        bgColor="#f5f3ff"
      />

      {canViewFinance && (
        <StatCard
          title="All-time Bill Balance"
          value={formatMoney(valueOrLoading(stats?.pendingPayments))}
          icon={Hourglass}
          color="var(--color-danger)"
          bgColor="var(--color-danger-bg)"
        />
      )}
    </div>
  );
};

export default DashboardStats;
