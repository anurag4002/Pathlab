import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getBills, collectPayment, getBillById, voidBill } from '../../../services/billService';
import { getPatients } from '../../../services/patientService';
import { getDoctors } from '../../../services/doctorService';
import { getAgents } from '../../../services/agentService';
import { getTests } from '../../../services/testService';
import { getPackages } from '../../../services/packageService';
import { getPanels } from '../../../services/panelService';
import { downloadBillPdf, fetchBillQr, printBillPdf } from '../../../services/publicService';
import {
  DataTable,
  PageHeader,
  Button,
  StatusBadge,
  Select,
  Input,
  Modal,
  AdvancedFilterBar,
  DURATION_OPTIONS
} from '../../../components/common';
import { BILL_TABLE_HEADERS, BILL_STATUS_OPTIONS } from '../../../constants/billConstants';
const CASE_TYPE_OPTIONS = ['LabCase','UsgCase','DigitalXrayCase','XrayCase','OutsourceLabCase','EcgCase','CtScanCase','MriCase','EpsCase','OpgCase','CardiologyCase','EegCase','MammographyCase'].map((v) => ({ value: v, label: v }));
import { BranchFilter } from '../../../components/common';
import { DEPARTMENTS } from '../billingConstants';
import BillCreateForm from '../components/BillCreateForm';
import PaymentCollectModal from '../components/PaymentCollectModal';
import { LabelPrintSheet } from '../../../components/lab';
import VoidReasonDialog from '../components/VoidReasonDialog';
import { usePermissions } from '../../../hooks/usePermission';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';
import useAuth from '../../../hooks/useAuth';
import { Plus, Printer, CreditCard, Ban, QrCode, FileDown, Eye, RefreshCw, Tag } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';
import { sanitizeBillSearchParam } from '../../../utils/billNavigation';
import '../Billing.css';

/* Local API error mapper (same mapping as the other lab screens): surfaces
   only the backend's user-facing `message` field, never stack traces. */
const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    const status = err.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested record was not found.';
    if (status === 409) return 'The record was changed elsewhere. Please refresh and try again.';
    if (status === 422) return 'The submitted data is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request) return 'Network error. Please check your connection and try again.';
  return err?.message || fallback;
};

/* Load-failure banner with a right-aligned retry — matches the create
   form's danger-bg error block. */
const ErrorBanner = ({ message, onRetry }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      backgroundColor: 'var(--color-danger-bg)',
      color: 'var(--color-danger)',
      borderRadius: 'var(--radius-sm)',
      marginBottom: 'var(--space-4)'
    }}
  >
    <span>{message}</span>
    <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={onRetry} style={{ marginLeft: 'auto' }}>
      Retry
    </Button>
  </div>
);

/* Section heading inside the bill-details modal — mirrors the Payment
   Details card header used by the create form. */
const DetailSection = ({ title }) => (
  <div
    style={{
      fontWeight: 'var(--font-weight-bold)',
      fontSize: 'var(--font-size-base)',
      borderBottom: '1px solid var(--color-border)',
      paddingBottom: 'var(--space-3)',
      marginTop: 'var(--space-4)'
    }}
  >
    {title}
  </div>
);

const BillsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const isCreateView = location.pathname.endsWith('/new');

  // Data for dropdowns in create form
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [agents, setAgents] = useState([]);
  const [tests, setTests] = useState([]);
  const [packages, setPackages] = useState([]);
  const [panels, setPanels] = useState([]);

  // List view
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterVoided, setFilterVoided] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [adv, setAdv] = useState({
    duration: 'Past 7 days',
    regNo: '',
    firstName: '',
    referredBy: '',
    collectionCentre: '',
    agent: '',
    hasDue: false,
    cancelled: false,
    caseType: '',
    uhid: '',
    dailyCaseNo: ''
  });
  const setAdvKey = (key, value) => setAdv((previous) => ({ ...previous, [key]: value }));
  // List/options load failures — surfaced as banners so a failed fetch never
  // reads as "no bills found"; each fetch owns its error state.
  const [listError, setListError] = useState(null);
  const [optionsError, setOptionsError] = useState(null);

  // Per-invoice details (GET /bills/:id — populated items + cashier).
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  // Modals
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetBill, setPaymentTargetBill] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentSubmitLoading, setPaymentSubmitLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  const [voidTarget, setVoidTarget] = useState(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState(null);

  // Phase 8 + 11 — label / sticker printing per bill.
  const [labelTarget, setLabelTarget] = useState(null);
  const { can } = usePermissions();
  const canBill = can('billing');

  const fetchBillsList = async () => {
    setLoading(true);
    try {
      const res = await getBills({
        search: debouncedSearch || undefined,
        paymentStatus: filterStatus || undefined,
        department: filterDept || undefined,
        patientId: filterPatient || undefined,
        startDate: filterFrom || undefined,
        endDate: filterTo || undefined,
        includeVoided: filterVoided || undefined,
        branch: filterBranch || undefined,
        duration: adv.duration || undefined,
        regNo: adv.regNo || undefined,
        firstName: adv.firstName || undefined,
        referredBy: adv.referredBy || undefined,
        collectionCentre: adv.collectionCentre || undefined,
        agent: adv.agent || undefined,
        hasDue: adv.hasDue ? 'true' : undefined,
        cancelled: adv.cancelled ? 'true' : undefined,
        caseType: adv.caseType || undefined,
        uhid: adv.uhid || undefined,
        dailyCaseNo: adv.dailyCaseNo || undefined,
        page,
        limit
      });
      if (res.success) {
        setBills(res.data.bills);
        setPaginationInfo(res.data.pagination);
        setListError(null);
      }
    } catch (err) {
      setBills([]);
      setListError(getApiErrorMessage(err, 'Failed to load billing records.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchFormOptions = async () => {
    try {
      const [patRes, docRes, agentRes, testRes, pkgRes, panelRes] = await Promise.all([
        getPatients({ limit: 100 }),
        getDoctors({ status: 'Active' }),
        getAgents({ status: 'Active' }),
        getTests({ status: 'Active' }),
        getPackages(),
        getPanels()
      ]);
      if (patRes.success) setPatients(patRes.data.patients);
      if (docRes.success) setDoctors(docRes.data);
      if (agentRes.success) setAgents(agentRes.data);
      if (testRes.success) setTests(testRes.data);
      if (pkgRes.success) setPackages(Array.isArray(pkgRes.data) ? pkgRes.data : []);
      if (panelRes.success) setPanels(Array.isArray(panelRes.data) ? panelRes.data : []);
      setOptionsError(null);
    } catch (err) {
      setOptionsError(getApiErrorMessage(err, 'Failed to load billing form options.'));
    }
  };

  useEffect(() => {
    if (!isCreateView) {
      fetchBillsList();
    }
  }, [
    debouncedSearch,
    filterStatus,
    filterDept,
    filterPatient,
    filterFrom,
    filterTo,
    filterVoided,
    filterBranch,
    page,
    limit,
    isCreateView,
    adv.duration,
    adv.referredBy,
    adv.collectionCentre,
    adv.agent,
    adv.hasDue,
    adv.cancelled,
    adv.caseType
  ]);

  useEffect(() => {
    fetchFormOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume an incoming `?search=` deep-link (View Bill / global search).
  // Sanitized so a missing value can never show up as "undefined", and
  // re-runs when the query string changes while already on this page.
  useEffect(() => {
    const querySearch = sanitizeBillSearchParam(searchParams.get('search'));
    if (querySearch) {
      setSearch(querySearch);
      goToPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleOpenPayment = (bill) => {
    setPaymentTargetBill(bill);
    setPaymentAmount(bill.dueAmount);
    setPaymentMethod('Cash');
    setPaymentError(null);
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async () => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Amount must be greater than 0.');
      return;
    }
    if (!paymentTargetBill || amount > Number(paymentTargetBill.dueAmount)) {
      setPaymentError(`Amount cannot exceed the due balance (${paymentTargetBill?.dueAmount || 0}).`);
      return;
    }
    if (!paymentMethod) {
      setPaymentError('Payment mode is required.');
      return;
    }
    setPaymentError(null);
    setPaymentSubmitLoading(true);
    try {
      const res = await collectPayment(paymentTargetBill._id, { amount, paymentMethod });
      if (res.success) {
        setPaymentModalOpen(false);
        // Reconcile from the server: the response carries the recomputed
        // paid/due/status, and the list refresh re-reads the ledger.
        alert(
          res.data?.dueAmount !== undefined
            ? `Payment recorded. Remaining due: ${formatCurrency(res.data.dueAmount)}`
            : 'Payment recorded.'
        );
        fetchBillsList();
      }
    } catch (err) {
      setPaymentError(getApiErrorMessage(err, 'Payment collection failed.'));
    } finally {
      setPaymentSubmitLoading(false);
    }
  };

  // Print sends the server PDF straight to the print dialog (no new tab).
  const handleOpenPrint = async (bill) => {
    try {
      await printBillPdf(bill._id, true);
    } catch {
      alert('Failed to print bill');
    }
  };

  const handleVoidConfirm = async (reason) => {
    if (!voidTarget) return;
    if (!reason || !String(reason).trim()) return;
    setVoidError(null);
    setVoidLoading(true);
    try {
      const res = await voidBill(voidTarget._id, String(reason).trim());
      if (res.success) {
        setVoidTarget(null);
        setVoidError(null);
        alert('Bill voided.');
        fetchBillsList();
      }
    } catch (err) {
      setVoidError(getApiErrorMessage(err, 'Failed to void bill.'));
    } finally {
      setVoidLoading(false);
    }
  };

  // Per-invoice details via the existing GET /bills/:id (populated patient,
  // doctor, agent, item lines and cashier). Called from click handlers only.
  const openDetails = async (bill) => {
    if (!bill) return;
    setDetailsTarget(bill);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const res = await getBillById(bill._id);
      if (res.success) setDetails(res.data);
      else setDetailsError('Invoice details are unavailable.');
    } catch (err) {
      setDetailsError(getApiErrorMessage(err, 'Failed to load invoice details.'));
    } finally {
      setDetailsLoading(false);
    }
  };

  // Retry for the load-failure banners — re-runs both page loads; each
  // success path clears its own error state.
  const retryLoad = () => {
    if (!isCreateView) fetchBillsList();
    fetchFormOptions();
  };

  const detailPatientName = details?.patient?.name || detailsTarget?.patient?.name || '';

  const handleShowQr = async (bill) => {
    try {
      const res = await fetchBillQr(bill._id);
      if (res.success) window.open(res.data.verifyUrl, '_blank', 'noopener');
    } catch {
      alert('Failed to load bill QR');
    }
  };

  if (isCreateView) {
    return (
      <div>
        {optionsError && <ErrorBanner message={optionsError} onRetry={retryLoad} />}
        <BillCreateForm
          patients={patients}
          doctors={doctors}
          agents={agents}
          tests={tests}
          packages={packages}
          panels={panels}
          onBillCreated={fetchBillsList}
        />
      </div>
    );
  }

  // Department filter is sent to the server AND applied client-side, so the
  // ledger stays correct even if the server ignores the param.
  const visibleBills = filterDept
    ? bills.filter((b) => String(b.department || '').toUpperCase() === String(filterDept).toUpperCase())
    : bills;

  return (
    <div>
      <PageHeader
        title="Billing Ledger"
        subtitle="Manage patient billing receipts and outstanding balances"
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!canBill && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                No billing permission — actions hidden (server still enforces).
              </span>
            )}
            {canBill && (
              <Button variant="primary" onClick={() => navigate('/cases/bills/new')} icon={<Plus size={16} />}>
                Create Bill
              </Button>
            )}
          </div>
        }
      />
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Refunds and post-payment bill edits are currently disabled.
      </p>

      {(listError || optionsError) && <ErrorBanner message={listError || optionsError} onRetry={retryLoad} />}


      <div style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <Select
          placeholder="All Payment Statuses"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); goToPage(1); }}
          options={BILL_STATUS_OPTIONS}
          style={{ maxWidth: '15rem' }}
        />
        <Select
          placeholder="All Departments"
          value={filterDept}
          onChange={(e) => { setFilterDept(e.target.value); goToPage(1); }}
          options={DEPARTMENTS.map((d) => ({ value: d.name, label: d.name }))}
          style={{ maxWidth: '15rem' }}
        />
        <Select
          placeholder="All Patients"
          value={filterPatient}
          onChange={(e) => { setFilterPatient(e.target.value); goToPage(1); }}
          options={patients.map((p) => ({ value: p._id, label: `${p.name} (${p.registrationNumber})` }))}
          style={{ maxWidth: '15rem' }}
        />
        <Input
          label="From"
          type="date"
          value={filterFrom}
          onChange={(e) => { setFilterFrom(e.target.value); goToPage(1); }}
          style={{ maxWidth: '10rem' }}
        />
        <Input
          label="To"
          type="date"
          value={filterTo}
          onChange={(e) => { setFilterTo(e.target.value); goToPage(1); }}
          style={{ maxWidth: '10rem' }}
        />
        <Select
          value={filterVoided}
          onChange={(e) => { setFilterVoided(e.target.value); goToPage(1); }}
          options={[
            { value: '', label: 'Exclude voided bills' },
            { value: 'true', label: 'Include voided bills' }
          ]}
          style={{ maxWidth: '14rem' }}
        />
        <BranchFilter value={filterBranch} onChange={(v) => { setFilterBranch(v); goToPage(1); fetchBillsList(); }} />
      </div>

      <AdvancedFilterBar
        values={adv}
        onChange={setAdvKey}
        onSearch={() => { goToPage(1); fetchBillsList(); }}
        onClear={() => { setAdv({ duration: '', regNo: '', firstName: '', referredBy: '', collectionCentre: '', agent: '', hasDue: false, cancelled: false, caseType: '', uhid: '', dailyCaseNo: '' }); setSearch(''); setFilterStatus(''); setFilterDept(''); goToPage(1); }}
        fields={[
          { key: 'duration', label: 'Duration', type: 'select', options: DURATION_OPTIONS },
          { key: 'regNo', label: 'Reg.no.', type: 'text', placeholder: 'Reg.no.' },
          { key: 'firstName', label: 'Patient first name', type: 'text', placeholder: 'First name' },
          { key: 'uhid', label: 'UHID', type: 'text', placeholder: 'UHID' },
          { key: 'dailyCaseNo', label: 'Daily case no.', type: 'text', placeholder: 'DCN' },
          { key: 'referredBy', label: 'Referred by', type: 'select', options: doctors.map((d) => ({ value: d._id || d.id || d.value, label: d.name || d.label })) },
          { key: 'collectionCentre', label: 'Collection centre', type: 'select', options: [{ value: 'Main', label: 'Main' }] },
          { key: 'agent', label: 'Sample agent', type: 'select', options: agents.map((a) => ({ value: a._id || a.id || a.value, label: a.name || a.label })) },
          { key: 'caseType', label: 'Case type', type: 'select', options: CASE_TYPE_OPTIONS },
          { key: 'hasDue', label: 'Has due', type: 'toggle' },
          { key: 'cancelled', label: 'Cancelled', type: 'toggle' },
        ]}
      />

      <DataTable
        headers={BILL_TABLE_HEADERS}
        data={visibleBills}
        loading={loading}
        emptyMessage="No billing records found."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        searchPlaceholder="Search by invoice number..."
        stickyActions
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit,
        }}
        renderRow={(bill) => (
          <tr key={bill._id}>
            <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{bill.billNumber}</td>
            <td>{bill.patient?.name || 'Walk-in Patient'}</td>
            <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{formatCurrency(bill.totalAmount)}</td>
            <td>{formatCurrency(bill.discount || 0)}</td>
            <td style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
              {formatCurrency(bill.paidAmount)}
            </td>
            <td
              style={{
                fontWeight: 'var(--font-weight-semibold)',
                color: bill.dueAmount > 0 ? 'var(--color-danger)' : 'inherit'
              }}
            >
              {formatCurrency(bill.dueAmount)}
            </td>
            <td>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge status={bill.paymentStatus} />
                {bill.isVoided && <StatusBadge status="Voided" />}
              </div>
            </td>
            <td>{formatDate(bill.date)}</td>
            <td>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <Button variant="secondary" size="sm" onClick={() => openDetails(bill)} icon={<Eye size={14} />}>
                  Details
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleOpenPrint(bill)} icon={<Printer size={14} />}>
                  Print
                </Button>
                <Button variant="secondary" size="sm" onClick={() => downloadBillPdf(bill._id, true)} icon={<FileDown size={14} />}>
                  PDF
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleShowQr(bill)} icon={<QrCode size={14} />}>
                  QR
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setLabelTarget(bill)} icon={<Tag size={14} />}>
                  Labels
                </Button>
                {bill.dueAmount > 0 && (
                  <Button variant="primary" size="sm" onClick={() => handleOpenPayment(bill)} icon={<CreditCard size={14} />}>
                    Pay
                  </Button>
                )}
                {isAdmin && !bill.isVoided && (
                  <Button variant="danger" size="sm" onClick={() => setVoidTarget(bill)} icon={<Ban size={14} />}>
                    Void
                  </Button>
                )}
                <Button variant="secondary" size="sm" disabled title="Not available">
                  Refund
                </Button>
                <Button variant="secondary" size="sm" disabled title="Not available">
                  Edit
                </Button>
              </div>
            </td>
          </tr>
        )}
      />

      <PaymentCollectModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        bill={paymentTargetBill}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        onSubmit={handlePaymentSubmit}
        loading={paymentSubmitLoading}
        error={paymentError}
      />

      {/* Bill details — every value below comes from GET /bills/:id. */}
      <Modal
        isOpen={!!detailsTarget}
        onClose={() => setDetailsTarget(null)}
        title={`Invoice ${detailsTarget?.billNumber || ''}`}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(
                  detailPatientName
                    ? `/cases/transactions?search=${encodeURIComponent(detailPatientName)}`
                    : '/cases/transactions'
                )
              }
            >
              Patient transactions
            </Button>
            <Button variant="primary" onClick={() => setDetailsTarget(null)}>
              Close
            </Button>
          </>
        }
      >
        {detailsLoading && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Loading invoice details…
          </p>
        )}
        {!detailsLoading && detailsError && (
          <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span>{detailsError}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openDetails(detailsTarget)}
              icon={<RefreshCw size={14} />}
            >
              Retry
            </Button>
          </div>
        )}
        {!detailsLoading && !detailsError && details && (
          <div>
            <DetailSection title="Bill details" />
            <div className="payment-summary-row">
              <span>Patient</span>
              <strong>
                {details.patient?.name || '—'}
                {details.patient?.registrationNumber ? ` (${details.patient.registrationNumber})` : ''}
              </strong>
            </div>
            <div className="payment-summary-row">
              <span>Invoice date</span>
              <strong>{formatDate(details.date)}</strong>
            </div>
            <div className="payment-summary-row">
              <span>Department</span>
              <strong>{details.department || '—'}</strong>
            </div>
            <div className="payment-summary-row">
              <span>Referring doctor</span>
              <strong>{details.referringDoctor?.name || 'Self / Walk-in'}</strong>
            </div>
            <div className="payment-summary-row">
              <span>Collection agent</span>
              <strong>{details.agent?.name || 'None'}</strong>
            </div>
            <div className="payment-summary-row">
              <span>Billed by</span>
              <strong>{details.createdBy?.name || '—'}</strong>
            </div>
            {details.isVoided && (
              <div className="payment-summary-row">
                <span>Voided</span>
                <strong>{details.voidReason || 'No reason recorded'}</strong>
              </div>
            )}

            <DetailSection title="Selected services" />
            {details.items?.length ? (
              <table className="bill-items-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Item</th>
                    <th style={{ textAlign: 'left' }}>Type</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {details.items.map((it) => (
                    <tr key={it._id}>
                      <td>{it.name}</td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>{it.itemType}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                        {formatCurrency(it.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                No service lines recorded on this invoice.
              </p>
            )}

            <DetailSection title="Financial summary" />
            <div className="payment-summary-row">
              <span>Total</span>
              <strong>{formatCurrency(details.totalAmount)}</strong>
            </div>
            <div className="payment-summary-row">
              <span>Discount</span>
              <strong>{formatCurrency(details.discount || 0)}</strong>
            </div>
            <div className="payment-summary-row">
              <span>Paid</span>
              <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(details.paidAmount)}</strong>
            </div>
            <div className="payment-summary-row">
              <span>Due</span>
              <strong style={{ color: details.dueAmount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {formatCurrency(details.dueAmount)}
              </strong>
            </div>

            <DetailSection title="Payment information" />
            <div className="payment-summary-row">
              <span>Payment method</span>
              <strong>{details.paymentMethod || '—'}</strong>
            </div>
            <div className="payment-summary-row">
              <span>Payment status</span>
              <StatusBadge status={details.paymentStatus} />
            </div>
          </div>
        )}
      </Modal>

      <LabelPrintSheet
        isOpen={!!labelTarget}
        onClose={() => setLabelTarget(null)}
        patient={labelTarget?.patient}
        bill={labelTarget}
      />

      <VoidReasonDialog
        isOpen={!!voidTarget}
        onClose={() => { setVoidTarget(null); setVoidError(null); }}
        bill={voidTarget}
        onConfirm={handleVoidConfirm}
        loading={voidLoading}
        error={voidError}
      />
    </div>
  );
};

export default BillsPage;
