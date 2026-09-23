import React, { useState, useEffect } from 'react';
import { getTransactions } from '../../services/transactionService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { PAYMENT_METHODS } from '../../constants/billConstants';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import { DataTable, PageHeader, Select, StatusBadge } from '../../components/common';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [filterType, setFilterType] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await getTransactions({
        search: debouncedSearch,
        type: filterType,
        paymentMethod: filterMethod,
        page,
        limit
      });
      if (res.success) {
        setTransactions(res.data.transactions);
        setPaginationInfo(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load transaction ledger', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [debouncedSearch, filterType, filterMethod, page, limit]);

  return (
    <div>
      <PageHeader
        title="Financial Transactions Audit"
        subtitle="Chronological audit trail of all receipts, partial collections, and refunds"
      />

      {/* Filter Row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Select
          placeholder="Filter by Type"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            goToPage(1);
          }}
          options={[
            { value: 'Income', label: 'Income' },
            { value: 'Refund', label: 'Refund' },
            { value: 'Expense', label: 'Expense' }
          ]}
          style={{ minWidth: '180px', marginBottom: 0 }}
        />

        <Select
          placeholder="Filter by Method"
          value={filterMethod}
          onChange={(e) => {
            setFilterMethod(e.target.value);
            goToPage(1);
          }}
          options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
          style={{ minWidth: '180px', marginBottom: 0 }}
        />
      </div>

      <DataTable
        headers={['Date & Time', 'Patient Name', 'Related Invoice', 'Amount', 'Payment Mode', 'Received By']}
        data={transactions}
        loading={loading}
        emptyMessage="No transaction logs matched your query criteria."
        searchValue={search}
        onSearchChange={(e) => {
          setSearch(e.target.value);
          goToPage(1);
        }}
        searchPlaceholder="Search by patient name..."
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit
        }}
        renderRow={(tx) => (
          <tr key={tx._id}>
            <td>{formatDate(tx.date)}</td>
            <td style={{ fontWeight: '600' }}>{tx.patient?.name || 'Walk-in Patient'}</td>
            <td>{tx.bill?.billNumber || 'N/A'}</td>
            <td style={{ fontWeight: '700', color: tx.type === 'Refund' ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {tx.type === 'Refund' ? '-' : ''}{formatCurrency(tx.amount)}
            </td>
            <td>
              <StatusBadge status={tx.paymentMethod} />
            </td>
            <td>{tx.receivedBy?.name || 'N/A'}</td>
          </tr>
        )}
      />
    </div>
  );
};

export default Transactions;
