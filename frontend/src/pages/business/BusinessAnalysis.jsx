import React, { useState, useEffect } from 'react';
import { getSummary, getDailyBusiness } from '../../services/dashboardService';
import formatCurrency from '../../utils/formatCurrency';
import { PageHeader } from '../../components/common';

const BusinessAnalysis = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        const res = await getSummary();
        if (res.success) {
          setStats(res.data);
        }
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

  // Define some static mockup trends data since our DB has limited seed
  const monthlyTrends = [
    { month: 'Mar', revenue: 45000, expenses: 18000 },
    { month: 'Apr', revenue: 52000, expenses: 22000 },
    { month: 'May', revenue: 61000, expenses: 21000 },
    { month: 'Jun', revenue: 58000, expenses: 24000 },
    { month: 'Jul', revenue: 73000, expenses: 29000 },
    { month: 'Aug', revenue: stats?.paymentSummary?.total || 60000, expenses: 18000 }
  ];

  const maxRevenue = Math.max(...monthlyTrends.map(t => t.revenue));

  return (
    <div>
      <PageHeader
        title="Business Intelligence Analysis"
        subtitle="Visual margins analysis, revenue streams tracking, and operational trends"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        
        {/* Graphical Monthly Revenue chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.5rem' }}>Revenue Trends (Last 6 Months)</h3>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '200px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
            {monthlyTrends.map((trend, idx) => {
              const heightPercentage = (trend.revenue / maxRevenue) * 100;
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  {/* Bar */}
                  <div
                    style={{
                      height: `${heightPercentage}%`,
                      width: '24px',
                      backgroundColor: 'var(--primary-color)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.5s ease',
                      position: 'relative'
                    }}
                    title={`Rev: ${formatCurrency(trend.revenue)}`}
                  >
                    <div style={{ position: 'absolute', top: '-24px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.675rem', fontWeight: '600' }}>
                      {trend.month}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>{trend.month}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center' }}>
            Bars indicate monthly gross invoicing totals.
          </p>
        </div>

        {/* Marginal Splits */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>Operating Margin Split</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '4px' }}>
                <span>Gross Collections</span>
                <strong>100%</strong>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-success)' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '4px' }}>
                <span>Expenses Margin</span>
                <strong>{stats?.paymentSummary?.total ? Math.round((18000 / stats.paymentSummary.total) * 100) : 30}%</strong>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${stats?.paymentSummary?.total ? Math.min(100, Math.round((18000 / stats.paymentSummary.total) * 100)) : 30}%`, height: '100%', backgroundColor: 'var(--color-danger)' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '4px' }}>
                <span>Net Retention margin</span>
                <strong>{stats?.paymentSummary?.total ? Math.round(((stats.paymentSummary.total - 18000) / stats.paymentSummary.total) * 100) : 70}%</strong>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${stats?.paymentSummary?.total ? Math.max(0, Math.round(((stats.paymentSummary.total - 18000) / stats.paymentSummary.total) * 100)) : 70}%`, height: '100%', backgroundColor: 'var(--primary-color)' }}></div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Retention indicates profit margins after deducting operational expenses and clinic bills.
          </div>
        </div>

      </div>
    </div>
  );
};

export default BusinessAnalysis;
