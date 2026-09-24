import React, { useState, useEffect, useMemo } from 'react';
import { getSummary, getMonthlyTrends, getDailyBusiness } from '../../services/dashboardService';
import formatCurrency from '../../utils/formatCurrency';
import { PageHeader, StatCard, EmptyState, Button } from '../../components/common';
import { TrendingUp, BarChart3, Wallet, Receipt, PiggyBank, Undo2, RefreshCw, Landmark, Users, Building2 } from 'lucide-react';
import { SvgBars, SvgLine } from '../../components/charts/SvgCharts';
import './BusinessAnalysis.css';

const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'custom', label: 'Custom' },
];

const rangeFor = (preset, from, to) => {
  const end = new Date();
  if (preset === 'today') return { start: toISODate(end), end: toISODate(end) };
  if (preset === '7d') {
    const s = new Date(end);
    s.setDate(s.getDate() - 6);
    return { start: toISODate(s), end: toISODate(end) };
  }
  if (preset === '30d') {
    const s = new Date(end);
    s.setDate(s.getDate() - 29);
    return { start: toISODate(s), end: toISODate(end) };
  }
  return { start: from || toISODate(end), end: to || toISODate(end) };
};

const BusinessAnalysis = () => {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [preset, setPreset] = useState('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const range = useMemo(() => rangeFor(preset, from, to), [preset, from, to]);

  const loadAnalysis = async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [statsRes, trendsRes, dailyRes] = await Promise.all([
        getSummary().catch(() => ({ data: null })),
        getMonthlyTrends().catch(() => ({ data: [] })),
        getDailyBusiness(range.start, range.end).catch(() => ({ data: null })),
      ]);
      if (statsRes && statsRes.data) setStats(statsRes.data);
      const t = trendsRes && trendsRes.data;
      setTrends(Array.isArray(t) ? t : t?.trends || []);
      if (dailyRes && dailyRes.data) setDailyData(dailyRes.data);
    } catch (err) {
      console.error('Failed to load analytical metrics', err);
      setError('Could not load analysis. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  const hasTrendsData = trends.some((t) => (t.revenue || 0) > 0 || (t.expenses || 0) > 0);
  const trendLine = trends.map((t) => ({ label: t.month, value: t.revenue || 0 }));
  const workloadBars = (dailyData?.monthlyOverview || []).map((d) => ({
    label: String(d.date || '').slice(5),
    value: d.income || 0,
  }));
  const hasWorkload = workloadBars.some((b) => b.value > 0);

  const totalIncome = dailyData?.totalIncome ?? stats?.paymentSummary?.cleared ?? 0;
  const totalExpenses = dailyData?.totalExpenses ?? 0;
  const totalRefunds = dailyData?.totalRefunds ?? 0;
  const netIncome = dailyData?.netIncome ?? Math.max(0, totalIncome - totalExpenses - totalRefunds);
  const expensePercentage = totalIncome > 0 ? Math.min(100, Math.round((totalExpenses / totalIncome) * 100)) : 0;
  const retentionPercentage = totalIncome > 0 ? Math.max(0, 100 - expensePercentage) : 0;

  const payModes = useMemo(() => {
    const split = dailyData?.incomeSplit || {};
    return Object.entries(split)
      .map(([mode, value]) => ({ label: mode, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value);
  }, [dailyData]);
  const maxPay = Math.max(1, ...payModes.map((p) => p.value));

  const caseSplit = dailyData?.caseSplit || [];
  const cashiers = useMemo(() => {
    const list = dailyData?.cashierWise || [];
    return [...list].sort((a, b) => (b.income || 0) - (a.income || 0)).slice(0, 8);
  }, [dailyData]);

  if (loading) {
    return (
      <div className="bi-page">
        <PageHeader
          title="Business Intelligence Analysis"
          subtitle="Collections, margins, payment modes and department trends"
        />
        <div className="bi-kpis">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bi-card" aria-hidden="true">
              <div className="bi-skeleton" style={{ height: 18, width: '60%' }} />
              <div className="bi-skeleton" style={{ height: 32, width: '45%' }} />
            </div>
          ))}
        </div>
        <div className="bi-grid-2">
          {[0, 1].map((i) => (
            <div key={i} className="bi-card" aria-hidden="true">
              <div className="bi-skeleton" style={{ height: 20, width: '50%' }} />
              <div className="bi-skeleton" style={{ height: 180 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !dailyData && !stats) {
    return (
      <div className="bi-page">
        <PageHeader title="Business Intelligence Analysis" subtitle="Collections, margins, payment modes and department trends" />
        <div className="bi-card">
          <EmptyState title="Could not load analysis" message={error} />
          <div>
            <Button variant="primary" onClick={() => loadAnalysis()} icon={<RefreshCw size={15} />}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bi-page">
      <PageHeader
        title="Business Intelligence Analysis"
        subtitle={`Collections, margins and trends · ${range.start} → ${range.end}`}
        action={
          <Button variant="secondary" onClick={() => loadAnalysis(true)} loading={refreshing} icon={<RefreshCw size={15} />}>
            Refresh
          </Button>
        }
      />

      <div className="bi-controls">
        <div className="bi-presets" role="tablist" aria-label="Date range">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={preset === p.value}
              className={preset === p.value ? 'active' : ''}
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <label className="bi-date-field">
              From
              <input type="date" className="select-control" value={from} max={to || toISODate(new Date())} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="bi-date-field">
              To
              <input type="date" className="select-control" value={to} min={from || undefined} max={toISODate(new Date())} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
      </div>

      <div className="bi-kpis">
        <StatCard
          title="Gross Collections"
          value={formatCurrency(totalIncome)}
          icon={Wallet}
          color="var(--color-success, #16a34a)"
          bgColor="var(--color-success-bg, #f0fdf4)"
        />
        <StatCard
          title="Operational Expenses"
          value={formatCurrency(totalExpenses)}
          icon={Receipt}
          color="var(--color-danger, #dc2626)"
          bgColor="var(--color-danger-bg, #fef2f2)"
        />
        <StatCard
          title="Net Income"
          value={formatCurrency(netIncome)}
          icon={PiggyBank}
          color="var(--color-primary, #2563eb)"
          bgColor="var(--color-primary-light, #eff6ff)"
        />
        <StatCard
          title="Refunds"
          value={formatCurrency(totalRefunds)}
          icon={Undo2}
          color="var(--color-warning, #d97706)"
          bgColor="var(--color-warning-bg, #fffbeb)"
        />
      </div>

      <div className="bi-grid-2">
        <section className="bi-card" aria-label="Daily collections">
          <h3 className="bi-card-title"><BarChart3 size={17} /> Daily Collections</h3>
          {!hasWorkload ? (
            <EmptyState title="No collections" message="No daily collections recorded in this window." />
          ) : (
            <SvgBars data={workloadBars} height={200} />
          )}
        </section>

        <section className="bi-card" aria-label="Revenue trend">
          <h3 className="bi-card-title"><TrendingUp size={17} /> Revenue Trend — Last 6 Months</h3>
          {!hasTrendsData ? (
            <EmptyState title="No trend yet" message="Revenue trends populate automatically as bills and transactions complete." />
          ) : (
            <>
              <SvgLine data={trendLine} height={200} />
              <p className="bi-card-sub">Monthly gross totals from ledger transactions.</p>
            </>
          )}
        </section>
      </div>

      <div className="bi-grid-2">
        <section className="bi-card" aria-label="Operating margin">
          <h3 className="bi-card-title"><Landmark size={17} /> Operating Margin</h3>
          {totalIncome === 0 && totalExpenses === 0 ? (
            <EmptyState title="Nothing recorded" message="Margin splits update as billing and expense vouchers are logged." />
          ) : (
            <>
              <div className="bi-meter">
                <div className="bi-meter-top"><span>Gross collections</span><strong>{formatCurrency(totalIncome)} (100%)</strong></div>
                <div className="bi-meter-track"><div className="bi-meter-fill" style={{ width: '100%', backgroundColor: 'var(--color-success, #16a34a)' }} /></div>
              </div>
              <div className="bi-meter">
                <div className="bi-meter-top"><span>Operational expenses</span><strong>{formatCurrency(totalExpenses)} ({expensePercentage}%)</strong></div>
                <div className="bi-meter-track"><div className="bi-meter-fill" style={{ width: `${expensePercentage}%`, backgroundColor: 'var(--color-danger, #dc2626)' }} /></div>
              </div>
              <div className="bi-meter">
                <div className="bi-meter-top"><span>Net retention</span><strong>{formatCurrency(Math.max(0, totalIncome - totalExpenses))} ({retentionPercentage}%)</strong></div>
                <div className="bi-meter-track"><div className="bi-meter-fill" style={{ width: `${retentionPercentage}%`, backgroundColor: 'var(--color-primary, #2563eb)' }} /></div>
              </div>
              <p className="bi-card-sub">Retention is gross collections minus recorded operational expenses.</p>
            </>
          )}
        </section>

        <section className="bi-card" aria-label="Payment modes">
          <h3 className="bi-card-title"><Wallet size={17} /> Collections by Payment Mode</h3>
          {payModes.length === 0 || payModes.every((p) => p.value === 0) ? (
            <EmptyState title="No mode data" message="Payment-mode split appears once collections are recorded." />
          ) : (
            payModes.map((p) => (
              <div className="bi-meter" key={p.label}>
                <div className="bi-meter-top"><span>{p.label}</span><strong>{formatCurrency(p.value)}</strong></div>
                <div className="bi-meter-track">
                  <div className="bi-meter-fill" style={{ width: `${Math.round((p.value / maxPay) * 100)}%`, backgroundColor: 'var(--color-primary, #2563eb)' }} />
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <div className="bi-grid-2">
        <section className="bi-card" aria-label="Department split">
          <h3 className="bi-card-title"><Building2 size={17} /> Department Split</h3>
          {caseSplit.length === 0 ? (
            <EmptyState title="No department data" message="Department-wise bills appear here for the selected window." />
          ) : (
            <table className="bi-table">
              <thead>
                <tr><th>Department</th><th className="num">Cases</th><th className="num">Billed</th><th className="num">Collected</th><th className="num">Due</th></tr>
              </thead>
              <tbody>
                {caseSplit.map((d) => (
                  <tr key={d.department}>
                    <td style={{ fontWeight: 600 }}>{d.department}</td>
                    <td className="num">{d.count}</td>
                    <td className="num">{formatCurrency(d.billed)}</td>
                    <td className="num">{formatCurrency(d.collected)}</td>
                    <td className="num" style={{ color: d.due > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: d.due > 0 ? 700 : 400 }}>
                      {formatCurrency(d.due)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="bi-card" aria-label="Top collectors">
          <h3 className="bi-card-title"><Users size={17} /> Top Collectors</h3>
          {cashiers.length === 0 ? (
            <EmptyState title="No collector data" message="Per-staff collections appear here for the selected window." />
          ) : (
            <table className="bi-table">
              <thead>
                <tr><th>Staff</th><th className="num">Receipts</th><th className="num">Collected</th></tr>
              </thead>
              <tbody>
                {cashiers.map((c) => (
                  <tr key={c.userId}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="num">{c.count}</td>
                    <td className="num">{formatCurrency(c.income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
};

export default BusinessAnalysis;
