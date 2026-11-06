import React, { useState, useEffect } from 'react';
import { getBills, collectPayment } from '../../services/billService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { PAYMENT_METHODS } from '../../constants/billConstants';
import { DEPARTMENTS } from '../../features/billing/billingConstants';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import { CreditCard, Printer } from 'lucide-react';
import printReport, { fetchAllPages } from '../../utils/printReport';
import { money, dayLabel, sum } from '../../utils/reportFormat';
import { DataTable, PageHeader, Button, Modal, Input, Select, StatusBadge, AdvancedFilterBar, IdentityCell, StatGroup } from '../../components/common';
import { useUiVersion } from '../../utils/uiVersion';
import { getSummary } from '../../services/dashboardService';
import { usePermissions } from '../../hooks/usePermission';
import { notify } from '../../components/common/Toast/toast';

const DueReports = () => {
  const isV2 = useUiVersion() === 'v2';
  // Total balance due: same definition as the dashboard (not voided/cancelled).
  const [totalDue, setTotalDue] = useState(null);
  useEffect(() => { if (isV2) getSummary().then((res) => setTotalDue(res?.data?.pendingPayments ?? null)).catch(() => {}); }, [isV2]);
  const num = (text) => <span className="th-num">{text}</span>;
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
      // Outstanding = anything still owed (unpaid and part-paid); fully paid
      // rows are excluded below as a safety net.
      const res = await getBills({
        search: debouncedSearch,
        paymentStatus: 'Outstanding',
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
      notify(err.response?.data?.message || 'Payment collection failed');
    } finally {
      setPaymentSubmitLoading(false);
    }
  };

  // Print: every bill with money still to collect (all pages), oldest first.
  const [printing, setPrinting] = useState(false);
  const printDues = async () => {
    setPrinting(true);
    try {
      const all = (await fetchAllPages(async (p, size) => {
        const res = await getBills({ search: debouncedSearch, paymentStatus: 'Outstanding', page: p, limit: size });
        return { items: res?.data?.bills || [], pages: res?.data?.pagination?.pages || 1 };
      })).filter((b) => b.paymentStatus !== 'Paid' && Number(b.dueAmount) > 0)
        .filter((b) => !deptFilter || String(b.department || '').toUpperCase() === deptFilter.toUpperCase())
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      const daysOld = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
      await printReport({
        title: 'Dues - money still to collect',
        period: `As on ${dayLabel(new Date().toISOString().slice(0, 10))}`,
        filters: [deptFilter && `Department: ${deptFilter}`, debouncedSearch && `Search: ${debouncedSearch}`],
        summary: [
          { label: 'Bills with a balance', value: String(all.length) },
          { label: 'Billed', value: money(sum(all, (b) => b.totalAmount)) },
          { label: 'Received', value: money(sum(all, (b) => b.paidAmount)) },
          { label: 'Still to collect', value: money(sum(all, (b) => b.dueAmount)) },
        ],
        sections: [{
          columns: [{ label: 'Bill no' }, { label: 'Patient' }, { label: 'Phone' }, { label: 'Bill date' }, { label: 'Days', align: 'right' }, { label: 'Amount', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Still to collect', align: 'right' }],
          rows: all.map((b) => [b.billNumber, b.patient?.name || 'Walk-in', b.patient?.phone || '', dayLabel(b.date), String(daysOld(b.date)), money(b.totalAmount), money(b.paidAmount), money(b.dueAmount)]),
          totals: ['Total', `${all.length} bills`, '', '', '', money(sum(all, (b) => b.totalAmount)), money(sum(all, (b) => b.paidAmount)), money(sum(all, (b) => b.dueAmount))],
          empty: 'Nothing to collect - every bill is paid.',
        }],
        note: 'Days = days since the bill was made. Oldest bills first.',
      });
    } catch { notify('Could not prepare the print. Try again.'); } finally { setPrinting(false); }
  };

  return (
    <div>
      <PageHeader
        title="Outstanding Balances Due"
        subtitle="Trace and collect partial or unpaid balances on patient invoice files"
        action={<Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={printDues} loading={printing}>Print</Button>}
      />
      {!canCollect && (
        <p style={{ fontSize: '0.82rem', color: 'var(--color-warning, #a16207)', marginBottom: '1rem' }}>
          Your role has no billing/finance permission — the Collect action is hidden.
        </p>
      )}

      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!deptFilter}
        onClear={() => { setDeptFilter(''); goToPage(1); }}
        trailing={deptFilter ? 'Department filter applies to the loaded rows.' : null}
        values={{ dept: deptFilter }}
        onChange={(key, value) => {
          if (key === 'dept') { setDeptFilter(value); goToPage(1); }
        }}
        fields={[
          {
            key: 'dept',
            label: 'Department',
            type: 'select',
            placeholder: 'All Departments',
            options: DEPARTMENTS.map((d) => ({ value: d.name, label: d.name }))
          }
        ]}
      />

      {isV2 && (
        <StatGroup label="Dues summary" items={[
          { label: 'Total balance due', value: totalDue == null ? '—' : formatCurrency(totalDue), tone: totalDue > 0 ? 'danger' : undefined },
          { label: 'Bills with a balance', value: String(paginationInfo.total ?? 0) },
        ]} />
      )}
      <DataTable
        headers={isV2 ? ['Patient', 'Bill', num('Total'), num('Paid'), num('Due'), 'Status', ''] : ['Patient', 'Bill Number', 'Date', 'Gross Amount', 'Paid', 'Outstanding Due', 'Status', 'Actions']}
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
        renderRow={(bill) => isV2 ? (
          <tr key={bill._id}>
            <td><IdentityCell name={bill.patient?.name} copy={bill.patient?.phone ? { value: bill.patient.phone, label: 'phone' } : undefined} /></td>
            <td><div style={{ fontWeight: 600 }}>{bill.billNumber}</div><div className="cell-sub">{formatDate(bill.date).split(',')[0]}</div></td>
            <td className="num">{formatCurrency(bill.totalAmount)}</td>
            <td className="num">{bill.paidAmount > 0 ? formatCurrency(bill.paidAmount) : <span className="cell-empty">{formatCurrency(0)}</span>}</td>
            <td className="num is-due">{formatCurrency(bill.dueAmount)}</td>
            <td><StatusBadge status={bill.paymentStatus} /></td>
            <td>
              <div className="row-actions-v2">
                {canCollect ? <Button variant="primary" size="sm" icon={<CreditCard size={14} />} onClick={() => handleOpenPayment(bill)}>Collect</Button> : <span className="cell-empty">No access</span>}
              </div>
            </td>
          </tr>
        ) : (
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
