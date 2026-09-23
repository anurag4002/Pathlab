import React, { useState, useEffect, useMemo } from 'react';
import { getSummary } from '../../services/dashboardService';
import { getTestCategories, getTests } from '../../services/testService';
import formatCurrency from '../../utils/formatCurrency';
import { PageHeader, StatCard, EmptyState, Button } from '../../components/common';
import { FlaskConical, Receipt, Hourglass, FolderOpen, Layers, ClipboardList, RefreshCw, AlertCircle } from 'lucide-react';
import './TestCounts.css';

const TestCounts = () => {
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, catRes, testsRes] = await Promise.all([
        getSummary().catch(() => ({ data: null })),
        getTestCategories().catch(() => ({ data: [] })),
        getTests({ status: 'Active' }).catch(() => ({ data: [] })),
      ]);

      if (statsRes?.data) setStats(statsRes.data);
      // GET /api/tests returns a plain array; be tolerant of both shapes.
      const cats = catRes?.data;
      setCategories(Array.isArray(cats) ? cats : cats?.categories || []);
      const list = testsRes?.data;
      setTests(Array.isArray(list) ? list : list?.tests || []);
    } catch (err) {
      console.error('Failed to load audit metrics', err);
      setError('Could not load counts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  // Per-category test counts, sorted high → low.
  const categoryCounts = useMemo(() => {
    const byId = new Map();
    categories.forEach((c) => byId.set(String(c._id), { name: c.name, count: 0 }));
    let uncategorized = 0;
    tests.forEach((t) => {
      const id = t.category?._id ? String(t.category._id) : (typeof t.category === 'string' ? t.category : '');
      if (id && byId.has(id)) byId.get(id).count += 1;
      else uncategorized += 1;
    });
    const rows = [...byId.values()];
    if (uncategorized > 0) rows.push({ name: 'Uncategorized', count: uncategorized });
    return rows.sort((a, b) => b.count - a.count);
  }, [categories, tests]);

  const maxCount = Math.max(1, ...categoryCounts.map((c) => c.count));
  const totalActive = tests.length;

  if (loading) {
    return (
      <div className="test-counts-page">
        <PageHeader
          title="Test Counts"
          subtitle="Live catalog volumes, category splits and operational totals"
        />
        <div className="test-counts-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="test-counts-card" aria-hidden="true">
              <div className="test-counts-skeleton" style={{ height: 18, width: '60%' }} />
              <div className="test-counts-skeleton" style={{ height: 32, width: '40%' }} />
            </div>
          ))}
        </div>
        <div className="test-counts-split">
          <div className="test-counts-card" aria-hidden="true">
            <div className="test-counts-skeleton" style={{ height: 18, width: '45%' }} />
            <div className="test-counts-skeleton" style={{ height: 90 }} />
          </div>
          <div className="test-counts-card" aria-hidden="true">
            <div className="test-counts-skeleton" style={{ height: 18, width: '45%' }} />
            <div className="test-counts-skeleton" style={{ height: 90 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error && !stats && categories.length === 0) {
    return (
      <div className="test-counts-page">
        <PageHeader title="Test Counts" subtitle="Live catalog volumes, category splits and operational totals" />
        <div className="test-counts-card">
          <EmptyState
            icon={AlertCircle}
            title="Could not load counts"
            message={error}
          />
          <div>
            <Button variant="primary" onClick={fetchMetrics} icon={<RefreshCw size={15} />}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="test-counts-page">
      <PageHeader
        title="Test Counts"
        subtitle="Live catalog volumes, category splits and operational totals"
        action={
          <Button variant="secondary" onClick={fetchMetrics} icon={<RefreshCw size={15} />}>
            Refresh
          </Button>
        }
      />

      <div className="test-counts-grid">
        <StatCard
          title="Active Tests"
          value={totalActive || stats?.totalTests || 0}
          icon={FlaskConical}
          color="var(--color-primary, #2563eb)"
          bgColor="var(--color-primary-light, #eff6ff)"
        />
        <StatCard
          title="Test Categories"
          value={categories.length}
          icon={FolderOpen}
          color="var(--color-info, #0284c7)"
          bgColor="var(--color-info-bg, #f0f9ff)"
        />
        <StatCard
          title="Today's Bills"
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

      <div className="test-counts-split">
        <section className="test-counts-card" aria-label="Tests by category">
          <h3 className="test-counts-card-title"><Layers size={17} /> Tests by Category</h3>
          {categoryCounts.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No Categories Defined"
              message="Test categories will appear here once configured in the catalog."
            />
          ) : (
            <div className="test-counts-row">
              {categoryCounts.map((cat) => (
                <div key={cat.name} className="test-counts-cat">
                  <div className="test-counts-cat-top">
                    <span className="test-counts-cat-name" title={cat.name}>{cat.name}</span>
                    <span className="test-counts-cat-count">{cat.count} test{cat.count === 1 ? '' : 's'}</span>
                  </div>
                  <div className="test-counts-bar" aria-hidden="true">
                    <div
                      className="test-counts-bar-fill"
                      style={{ width: `${Math.round((cat.count / maxCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="test-counts-card" aria-label="Operational summary">
          <h3 className="test-counts-card-title"><ClipboardList size={17} /> Operational Summary</h3>
          <div>
            <div className="test-counts-summary-row">
              <span>Total invoiced cases</span>
              <strong className="accent">{stats?.totalCasesCount || 0}</strong>
            </div>
            <div className="test-counts-summary-row">
              <span>Total registered patients</span>
              <strong>{stats?.totalPatients || 0}</strong>
            </div>
            <div className="test-counts-summary-row">
              <span>Total catalogued tests</span>
              <strong>{stats?.totalTests || totalActive}</strong>
            </div>
            <div className="test-counts-summary-row">
              <span>Total revenue collected</span>
              <strong>{formatCurrency(stats?.paymentSummary?.cleared ?? stats?.todayRevenue ?? 0)}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TestCounts;
