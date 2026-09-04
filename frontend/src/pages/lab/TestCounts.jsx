import React, { useState, useEffect } from 'react';
import { getSummary } from '../../services/dashboardService';
import { getTestCategories } from '../../services/testService';
import formatCurrency from '../../utils/formatCurrency';
import { PageHeader, StatCard, EmptyState } from '../../components/common';
import { FlaskConical, Receipt, Hourglass, Layers } from 'lucide-react';

const TestCounts = () => {
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [statsRes, catRes] = await Promise.all([
          getSummary().catch(() => ({ data: null })),
          getTestCategories().catch(() => ({ data: [] }))
        ]);

        if (statsRes?.data) {
          setStats(statsRes.data);
        }
        if (catRes?.data) {
          setCategories(catRes.data);
        }
      } catch (err) {
        console.error('Failed to load audit metrics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
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
          icon={FlaskConical}
          color="var(--color-primary, #2563eb)"
          bgColor="var(--color-primary-light, #eff6ff)"
        />
        <StatCard
          title="Today's Patient Bills"
          value={stats?.todayBills || 0}
          icon={Receipt}
          color="var(--color-success, #16a34a)"
          bgColor="var(--color-success-bg, #f0fdf4)"
        />
        <StatCard
          title="Outstanding Payments"
          value={formatCurrency(stats?.pendingPayments || 0)}
          icon={Hourglass}
          color="var(--color-danger, #dc2626)"
          bgColor="var(--color-danger-bg, #fef2f2)"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
        {/* Category distribution */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--color-text, #0f172a)' }}>
            Active Test Categories
          </h3>
          {categories.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No Categories Defined"
              message="Test categories will appear here once configured in the catalog."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {categories.map((cat) => (
                <div
                  key={cat._id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--color-border, #e2e8f0)',
                    paddingBottom: '6px'
                  }}
                >
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #334155)' }}>
                    {cat.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-success, #16a34a)', backgroundColor: 'var(--color-success-bg, #f0fdf4)', padding: '2px 8px', borderRadius: '4px' }}>
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Operational Overview */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--color-text, #0f172a)' }}>
            Operational Summary
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border, #e2e8f0)', paddingBottom: '6px', fontSize: '0.875rem' }}>
              <span>Total Invoiced Cases</span>
              <strong style={{ color: 'var(--color-primary, #2563eb)' }}>{stats?.totalCasesCount || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border, #e2e8f0)', paddingBottom: '6px', fontSize: '0.875rem' }}>
              <span>Total Registered Patients</span>
              <strong>{stats?.totalPatients || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', fontSize: '0.875rem' }}>
              <span>Total Catalogued Tests</span>
              <strong>{stats?.totalTests || 0}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestCounts;
