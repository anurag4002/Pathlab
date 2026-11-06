import React from 'react';
import formatCurrency from '../../../utils/formatCurrency';
import { DataTable, StatusBadge } from '../../../components/common';
import formatDate from '../../../utils/formatDate';
import IdentityCell from '../../../components/common/IdentityCell/IdentityCell';
import { useUiVersion } from '../../../utils/uiVersion';

// Phase 18 — filterable transaction table for the cashbook.
// Search lives in the parent AdvancedFilterBar (Cashbook).
const TransactionTable = ({ transactions = [], loading, pagination, goToPage, onLimitChange }) => {
  const isV2 = useUiVersion() === 'v2';
  return (
  <DataTable
    headers={isV2 ? ['Patient', 'Mode', 'Received by', <span key="amount" className="th-num">Amount</span>] : ['Date & Time', 'Patient', 'Bill Ref', 'Type', 'Mode', 'Received By', 'Amount']}
    data={transactions}
    loading={loading}
    emptyMessage="No cashbook transactions for this window."
    pagination={pagination ? { ...pagination, onPageChange: goToPage, onLimitChange } : undefined}
    renderRow={(tx) => isV2 ? (
      <tr key={tx._id}>
        <td>
          <IdentityCell name={tx.patient?.name || 'Walk-in'} meta={[tx.bill?.billNumber && `Bill ${tx.bill.billNumber}`, formatDate(tx.date)]} />
          {tx.type === 'Refund' && <span style={{ marginLeft: '2.8rem' }}><StatusBadge status="Refund" /></span>}
        </td>
        <td><StatusBadge status={tx.paymentMethod} /></td>
        <td>{tx.receivedBy?.name || <span className="cell-empty">Unknown</span>}</td>
        <td className={`num${tx.type === 'Refund' ? ' is-due' : ''}`}>{tx.type === 'Refund' ? '−' : ''}{formatCurrency(tx.amount)}</td>
      </tr>
    ) : (
      <tr key={tx._id}>
        <td>{formatDate(tx.date)}</td>
        <td style={{ fontWeight: '600' }}>{tx.patient?.name || 'Walk-in'}</td>
        <td>{tx.bill?.billNumber || '—'}</td>
        <td><StatusBadge status={tx.type} /></td>
        <td><StatusBadge status={tx.paymentMethod} /></td>
        <td>{tx.receivedBy?.name || '—'}</td>
        <td style={{ fontWeight: '700', color: tx.type === 'Refund' ? 'var(--color-danger)' : 'var(--color-success)' }}>
          {tx.type === 'Refund' ? '-' : ''}{formatCurrency(tx.amount)}
        </td>
      </tr>
    )}
  />
  );
};

export default TransactionTable;
