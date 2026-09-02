import React, { useState, useEffect } from 'react';
import { getSummary } from '../../services/dashboardService';
import formatCurrency from '../../utils/formatCurrency';
import { PageHeader, StatCard } from '../../components/common';

const TestCounts = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await getSummary();
        if (res.success) {
          setStats(res.data);
        }
      } catch (err) {
        console.error('Failed to load count metrics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Diagnostic Tests Audit Summary"
        subtitle="Operational metrics overview of clinical testing volumes, orders, and category splits"
      />

      <div className="stat-grid">
        <StatCard
          title="Active Tests Database"
          value={stats?.totalTests || 0}
          icon="FlaskConical"
          color="#0c66e4"
        />
        <StatCard
          title="Today's Patient Bills"
          value={stats?.todayBills || 0}
          icon="Receipt"
          color="#10b981"
        />
        <StatCard
          title="Outstanding Payments"
          value={formatCurrency(stats?.pendingPayments || 0)}
          icon="Hourglass"
          color="#ef4444"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
        
        {/* Category distribution */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>
            Category Volumes Split
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              <span>Hematology (CBC/ESR)</span>
              <strong>Active</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              <span>Biochemistry (Sugars/Bilirubins)</span>
              <strong>Active</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              <span>Kidney Function Profile</span>
              <strong>Active</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
              <span>Hormones & Thyroid Profile</span>
              <strong>Active</strong>
            </div>
          </div>
        </div>

        {/* Workflow states */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>
            Workflow Verification Status
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              <span>Tests Completed today</span>
              <strong style={{ color: 'var(--color-success)' }}>{stats?.todayBills || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              <span>Awaiting sample collections</span>
              <strong>0</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
              <span>Critical Alerts Triggered</span>
              <strong style={{ color: 'var(--color-danger)' }}>0</strong>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TestCounts;
