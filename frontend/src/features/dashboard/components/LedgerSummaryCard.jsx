import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../../components/common';
import formatCurrency from '../../../utils/formatCurrency';
import useAuth from '../../../hooks/useAuth';
import '../Dashboard.css';

const hasValue = (value) =>
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));

const formatMoney = (value) => (hasValue(value) ? formatCurrency(value) : '—');

const LedgerSummaryCard = ({ paymentSummary, loading = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const value = (field) => (loading ? '—' : formatMoney(paymentSummary?.[field]));

  return (
    <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <h2 className="dashboard-card-title">Ledger Collection Summary</h2>
        <div className="ledger-summary-rows">
          <div className="ledger-summary-row">
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              Bill Payments · all-time
            </span>
            <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-success)' }}>
              {value('cleared')}
            </strong>
          </div>

          <div className="ledger-summary-row">
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              Bill Balance · all-time
            </span>
            <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-danger)' }}>
              {value('due')}
            </strong>
          </div>

          <div className="ledger-summary-row total">
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
              Bill Total · all-time
            </span>
            <strong style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)' }}>
              {value('total')}
            </strong>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/business/daily')}
            icon={<ArrowRight size={14} />}
          >
            Daily Business
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/business/monthly')}
            icon={<ArrowRight size={14} />}
          >
            Monthly Business
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/business/dues')}
            icon={<ArrowRight size={14} />}
          >
            Due Reports
          </Button>
        </div>
      )}
    </div>
  );
};

export default LedgerSummaryCard;
