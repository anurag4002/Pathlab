import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, StatusBadge, Button } from '../../../components/common';
import { RECENT_TRANSACTIONS_HEADERS } from '../../../constants/dashboardConstants';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';
import { getBillNumber, buildBillsSearchUrl } from '../../../utils/billNavigation';
import '../Dashboard.css';

const hasValue = (value) =>
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));

const formatMoney = (value) => (hasValue(value) ? formatCurrency(value) : '—');

const RecentTransactionsTable = ({ transactions = [], loading = false }) => {
  const navigate = useNavigate();

  return (
    <div className="dashboard-card">
      <div className="dashboard-widget-header">
        <h2 className="dashboard-card-title">Recent Financial Logs</h2>
        <Button variant="secondary" size="sm" onClick={() => navigate('/cases/transactions')}>
          View all
        </Button>
      </div>
      <DataTable
        className="dashboard-embedded-table"
        headers={RECENT_TRANSACTIONS_HEADERS}
        data={transactions}
        loading={loading}
        emptyMessage="No financial transaction records logged yet."
        renderRow={(tx) => {
          const billNumber = getBillNumber(tx.bill);
          const isOutflow = tx.type === 'Refund' || tx.type === 'Expense';
          return (
            <tr key={tx._id}>
              <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                {tx.patient?.name || 'Walk-in Patient'}
              </td>
              <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {tx.patient?.registrationNumber || 'N/A'}
              </td>
              <td>
                {tx.type ? <StatusBadge status={tx.type} /> : '—'}
              </td>
              <td style={{ fontWeight: 'var(--font-weight-bold)', color: isOutflow ? 'var(--color-danger)' : 'var(--color-text)' }}>
                {isOutflow && hasValue(tx.amount) ? `−${formatMoney(tx.amount)}` : formatMoney(tx.amount)}
              </td>
              <td>
                {tx.paymentMethod ? <StatusBadge status={tx.paymentMethod} /> : '—'}
              </td>
              <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {formatDate(tx.date)}
              </td>
              <td>
                {billNumber ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(buildBillsSearchUrl(tx.bill))}
                  >
                    View Bill
                  </Button>
                ) : (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    No bill
                  </span>
                )}
              </td>
            </tr>
          );
        }}
      />
    </div>
  );
};

export default RecentTransactionsTable;
