import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, StatusBadge, Button } from '../../../components/common';
import { RECENT_TRANSACTIONS_HEADERS } from '../../../constants/dashboardConstants';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';
import '../Dashboard.css';

const RecentTransactionsTable = ({ transactions = [] }) => {
  const navigate = useNavigate();

  return (
    <div className="dashboard-card">
      <h2 className="dashboard-card-title">Recent Financial Logs</h2>
      <DataTable
        headers={RECENT_TRANSACTIONS_HEADERS}
        data={transactions}
        emptyMessage="No financial transaction records logged yet."
        renderRow={(tx) => (
          <tr key={tx._id}>
            <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>
              {tx.patient?.name || 'Walk-in Patient'}
            </td>
            <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {tx.patient?.registrationNumber || 'N/A'}
            </td>
            <td style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
              {formatCurrency(tx.amount)}
            </td>
            <td>
              <StatusBadge status={tx.paymentMethod} />
            </td>
            <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {formatDate(tx.date)}
            </td>
            <td>
              {tx.bill && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/cases/bills?search=${tx.bill?.billNumber}`)}
                >
                  View Bill
                </Button>
              )}
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default RecentTransactionsTable;
