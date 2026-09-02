import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../../components/common';
import formatCurrency from '../../../utils/formatCurrency';
import '../Dashboard.css';

const LedgerSummaryCard = ({ paymentSummary }) => {
  const navigate = useNavigate();

  return (
    <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <h2 className="dashboard-card-title">Ledger Collection Summary</h2>
        <div className="ledger-summary-rows">
          <div className="ledger-summary-row">
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              Cleared Collections
            </span>
            <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-success)' }}>
              {formatCurrency(paymentSummary?.cleared || 0)}
            </strong>
          </div>

          <div className="ledger-summary-row">
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              Outstanding Balance
            </span>
            <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-danger)' }}>
              {formatCurrency(paymentSummary?.due || 0)}
            </strong>
          </div>

          <div className="ledger-summary-row total">
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
              Gross Ledger Total
            </span>
            <strong style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)' }}>
              {formatCurrency(paymentSummary?.total || 0)}
            </strong>
          </div>
        </div>
      </div>

      <Button
        variant="secondary"
        block
        onClick={() => navigate('/business/daily')}
        style={{ marginTop: 'var(--space-4)' }}
      >
        <span>View Detailed Ledger</span>
        <ArrowRight size={14} />
      </Button>
    </div>
  );
};

export default LedgerSummaryCard;
