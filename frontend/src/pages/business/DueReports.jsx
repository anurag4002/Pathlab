import React, { useState, useEffect } from 'react';
import { getBills, collectPayment } from '../../services/billService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { PAYMENT_METHODS } from '../../constants/billConstants';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import { CreditCard } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, StatusBadge } from '../../components/common';

const DueReports = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Pagination
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });

  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentSubmitLoading, setPaymentSubmitLoading] = useState(false);

  const fetchDueBills = async () => {
    setLoading(true);
    try {
      // Fetch Partial and Pending bills
      const res = await getBills({
        search: debouncedSearch,
        paymentStatus: 'Pending', // We will load Pending/Partial in separate fetches or filter in JS.
        // Or we can let backend return all, and filter.
        // Actually, our backend getBills accepts paymentStatus, so let's load all bills and filter in client or query.
        // Let's filter in client-side or fetch Pending and Partial bills.
        // Since getBills pagination returns limited, let's load all outstanding by not specifying paymentStatus,
        // then filter, or fetch with Partial and Pending. Let's load without filtering status,
        // and filter in the render row or search.
        page,
        limit
      });
      if (res.success) {
        // filter out fully paid ones
        const outstanding = res.data.bills.filter(b => b.paymentStatus !== 'Paid');
        setBills(outstanding);
        setPaginationInfo(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch due reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDueBills();
  }, [debouncedSearch, page, limit]);

  const handleOpenPayment = (bill) => {
    setPaymentTarget(bill);
    setPaymentAmount(bill.dueAmount);
    setPaymentMethod('Cash');
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (paymentAmount <= 0 || paymentAmount > paymentTarget.dueAmount) {
      alert('Invalid payment amount');
      return;
    }

    setPaymentSubmitLoading(true);
    try {
      const res = await collectPayment(paymentTarget._id, {
        amount: paymentAmount,
        paymentMethod
      });
      if (res.success) {
        setPaymentModalOpen(false);
        fetchDueBills();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Payment collection failed');
    } finally {
      setPaymentSubmitLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Outstanding Balances Due"
        subtitle="Trace and collect partial or unpaid balances on patient invoice files"
      />

      <DataTable
        headers={['Patient', 'Bill Number', 'Date', 'Gross Amount', 'Paid', 'Outstanding Due', 'Status', 'Actions']}
        data={bills}
        loading={loading}
        emptyMessage="No outstanding balances found."
        searchValue={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        searchPlaceholder="Search by invoice number..."
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage
        }}
        renderRow={(bill) => (
          <tr key={bill._id}>
            <td style={{ fontWeight: '600' }}>{bill.patient?.name || 'Walk-in Patient'}</td>
            <td style={{ fontWeight: '600' }}>{bill.billNumber}</td>
            <td>{formatDate(bill.date)}</td>
            <td>{formatCurrency(bill.totalAmount)}</td>
            <td style={{ color: 'var(--color-success)' }}>{formatCurrency(bill.paidAmount)}</td>
            <td style={{ fontWeight: '700', color: 'var(--color-danger)' }}>{formatCurrency(bill.dueAmount)}</td>
            <td>
              <StatusBadge status={bill.paymentStatus} />
            </td>
            <td>
              <button
                className="btn btn-primary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => handleOpenPayment(bill)}
              >
                <CreditCard size={14} /> Collect
              </button>
            </td>
          </tr>
        )}
      />

      {/* Collect Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Collect Outstanding Balance"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaymentModalOpen(false)} disabled={paymentSubmitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handlePaymentSubmit} loading={paymentSubmitLoading}>
              Log Payment
            </Button>
          </>
        }
      >
        {paymentTarget && (
          <div>
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
              Invoice: <strong>{paymentTarget.billNumber}</strong> | Remaining Due: <strong>{formatCurrency(paymentTarget.dueAmount)}</strong>
            </p>
            <Input
              label="Payment Amount Received"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Math.max(0, Math.min(Number(e.target.value), paymentTarget.dueAmount)))}
              required
            />
            <Select
              label="Payment Method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
              required
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DueReports;
