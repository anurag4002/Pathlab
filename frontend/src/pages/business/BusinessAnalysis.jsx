import React, { useState, useEffect } from 'react';
import { getSummary, getMonthlyTrends, getDailyBusiness } from '../../services/dashboardService';
import formatCurrency from '../../utils/formatCurrency';
import { PageHeader } from '../../components/common';
import { TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { SvgBars, SvgLine } from '../../components/charts/SvgCharts';

const BusinessAnalysis = () => {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        const [statsRes, trendsRes, dailyRes] = await Promise.all([
          getSummary().catch(() => ({ data: null })),
          getMonthlyTrends().catch(() => ({ data: [] })),
          getDailyBusiness().catch(() => ({ data: null }))
        ]);
        if (statsRes && statsRes.data) setStats(statsRes.data);
        if (trendsRes && trendsRes.data) setTrends(trendsRes.data);
        if (dailyRes && dailyRes.data) setDailyData(dailyRes.data);
      } catch (err) {
        console.error('Failed to load analytical metrics', err);
      } finally {
        setLoading(false);
      }
    };
    loadAnalysis();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const hasTrendsData = trends.some((t) => t.revenue > 0 || t.expenses > 0);
  const trendLine = trends.map((t) => ({ label: t.month, value: t.revenue || 0 }));
  const workloadBars = (dailyData?.monthlyOverview || []).map((d) => ({ label: d.date.slice(5), value: d.income || 0 }));
  const hasWorkload = workloadBars.some((b) => b.value > 0);

  const totalIncome = dailyData?.totalIncome || stats?.paymentSummary?.cleared || 0;
  const totalExpenses = dailyData?.totalExpenses || 0;
  const expensePercentage = totalIncome > 0 ? Math.min(100, Math.round((totalExpenses / totalIncome) * 100)) : 0;
  const retentionPercentage = totalIncome > 0 ? Math.max(0, 100 - expensePercentage) : 0;

  return (
    <div>
      <PageHeader
        title="Business Intelligence Analysis"
        subtitle="Visual margins analysis, revenue streams tracking, and operational trends"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Daily workload bars */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <BarChart3 size={18} color="var(--color-primary, #2563eb)" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>Daily Workload (Income/Day)</h3>
          </div>
          {!hasWorkload ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted, #64748b)' }}>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>No daily collections recorded in this window.</p>
            </div>
          ) : (
            <SvgBars data={workloadBars} height={200} />
          )}
        </div>

        {/* 6-month trend line */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <TrendingUp size={18} color="var(--color-primary, #2563eb)" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>Revenue Trends (Last 6 Months)</h3>
          </div>
          {!hasTrendsData ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted, #64748b)' }}>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>No transaction history recorded yet across the last 6 months.</p>
              <small>Revenue trends will automatically populate as new bills and transactions are completed.</small>
            </div>
          ) : (
            <>
              <SvgLine data={trendLine} height={200} />
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', marginTop: '12px', textAlign: 'center' }}>
                Monthly gross invoicing totals derived directly from ledger transactions.
              </p>
            </>
          )}
        </div>

        {/* Marginal Splits */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <PieChart size={18} color="var(--color-primary, #2563eb)" />
              <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>Operating Margin Split</h3>
            </div>
            {totalIncome === 0 && totalExpenses === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--color-text-muted, #64748b)' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>No operational revenue or expenses recorded yet.</p>
                <small>Margin splits will update as billing and expense vouchers are logged.</small>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '6px' }}>
                    <span>Gross Invoiced Collection</span>
                    <strong>{formatCurrency(totalIncome)} (100%)</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-border, #e2e8f0)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-success, #16a34a)' }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '6px' }}>
                    <span>Operational Expenses</span>
                    <strong>{formatCurrency(totalExpenses)} ({expensePercentage}%)</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-border, #e2e8f0)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${expensePercentage}%`, height: '100%', backgroundColor: 'var(--color-danger, #dc2626)' }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '6px' }}>
                    <span>Net Operating Retention</span>
                    <strong>{formatCurrency(Math.max(0, totalIncome - totalExpenses))} ({retentionPercentage}%)</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-border, #e2e8f0)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${retentionPercentage}%`, height: '100%', backgroundColor: 'var(--color-primary, #2563eb)' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '12px', marginTop: '16px', fontSize: '0.8125rem', color: 'var(--color-text-muted, #64748b)' }}>
            Retention represents gross revenue after deducting recorded operational expenses.
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessAnalysis;
