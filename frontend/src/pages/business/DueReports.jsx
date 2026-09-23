import React, { useState, useEffect } from 'react';
import { getBills, collectPayment } from '../../services/billService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { PAYMENT_METHODS } from '../../constants/billConstants';
import { DEPARTMENTS } from '../../features/billing/billingConstants';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import { CreditCard } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, StatusBadge } from '../../components/common';
import { usePermissions } from '../../hooks/usePermission';

const DueReports = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Pagination
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });

  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentSubmitLoading, setPaymentSubmitLoading] = useState(false);
  const [payError, setPayError] = useState('');
  // Department filter: server has no due-specific dept param, so this is
  // applied client-side on the returned bills.
  const [deptFilter, setDeptFilter] = useState('');
  const { can } = usePermissions();
  const canCollect = can('billing') || can('finance');

  const fetchDueBills = async () => {
    setLoading(true);
    try {
      // Outstanding = Pending/Partial payment status; fully paid rows are
      // excluded below as a safety net.
      const res = await getBills({
        search: debouncedSearch,
        paymentStatus: 'Pending',
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
    setPayError('');
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async () => {
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      setPayError('Amount must be greater than 0.');
      return;
    }
    if (amt > Number(paymentTarget.dueAmount)) {
      setPayError(`Amount cannot exceed the due balance (${paymentTarget.dueAmount}).`);
      return;
    }
    if (!paymentMethod) {
      setPayError('Payment mode is required.');
      return;
    }
    setPayError('');

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
      {!canCollect && (
        <p style={{ fontSize: '0.82rem', color: 'var(--color-warning, #a16207)', marginBottom: '1rem' }}>
          Your role has no billing/finance permission — the Collect action is hidden.
        </p>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          placeholder="All Departments"
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); goToPage(1); }}
          options={DEPARTMENTS.map((d) => ({ value: d.name, label: d.name }))}
          style={{ maxWidth: '15rem', marginBottom: 0 }}
        />
        {deptFilter && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Department filter applies to the loaded rows.
          </span>
        )}
      </div>

      <DataTable
        headers={['Patient', 'Bill Number', 'Date', 'Gross Amount', 'Paid', 'Outstanding Due', 'Status', 'Actions']}
        data={deptFilter ? bills.filter((b) => String(b.department || '').toUpperCase() === deptFilter.toUpperCase()) : bills}
        loading={loading}
        emptyMessage="No outstanding balances found."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        searchPlaceholder="Search by invoice number..."
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit
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
              {canCollect ? (
                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenPayment(bill)}
                >
                  <CreditCard size={14} /> Collect
                </button>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No access</span>
              )}
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
            {payError && <p className="form-error">{payError}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DueReports;
