import React from 'react';
import formatCurrency from '../../../utils/formatCurrency';
import { DataTable, StatusBadge } from '../../../components/common';
import formatDate from '../../../utils/formatDate';

// Phase 18 — filterable transaction table for the cashbook.
const TransactionTable = ({ transactions = [], loading, search, onSearchChange, pagination, goToPage, onLimitChange }) => (
  <DataTable
    headers={['Date & Time', 'Patient', 'Bill Ref', 'Type', 'Mode', 'Received By', 'Amount']}
    data={transactions}
    loading={loading}
    emptyMessage="No cashbook transactions for this window."
    searchValue={search}
    onSearchChange={onSearchChange}
    searchPlaceholder="Search patient / bill no..."
    pagination={pagination ? { ...pagination, onPageChange: goToPage, onLimitChange } : undefined}
    renderRow={(tx) => (
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

export default TransactionTable;
