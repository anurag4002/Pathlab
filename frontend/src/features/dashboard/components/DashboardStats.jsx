import React from 'react';
import { IndianRupee, Users, Receipt, Hourglass, FlaskConical, FolderOpen } from 'lucide-react';
import { StatCard } from '../../../components/common';
import formatCurrency from '../../../utils/formatCurrency';
import '../Dashboard.css';

const DashboardStats = ({ stats }) => {
  return (
    <>
      <div className="dashboard-stats-grid">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats?.todayRevenue || 0)}
          icon={IndianRupee}
          color="var(--color-success)"
          bgColor="var(--color-success-bg)"
        />
        <StatCard
          title="Total Patients"
          value={stats?.totalPatients || 0}
          icon={Users}
          color="var(--color-primary)"
          bgColor="var(--color-primary-light)"
        />
        <StatCard
          title="Today's Bills"
          value={stats?.todayBills || 0}
          icon={Receipt}
          color="var(--color-warning)"
          bgColor="var(--color-warning-bg)"
        />
        <StatCard
          title="Pending Payments"
          value={formatCurrency(stats?.pendingPayments || 0)}
          icon={Hourglass}
          color="var(--color-danger)"
          bgColor="var(--color-danger-bg)"
        />
      </div>

      <div className="dashboard-stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <StatCard
          title="Lab Tests Database"
          value={stats?.totalTests || 0}
          icon={FlaskConical}
          color="var(--color-info)"
          bgColor="var(--color-info-bg)"
        />
        <StatCard
          title="Total Cases Count"
          value={stats?.totalCasesCount || 0}
          icon={FolderOpen}
          color="#8b5cf6"
          bgColor="#f5f3ff"
        />
      </div>
    </>
  );
};

export default DashboardStats;
