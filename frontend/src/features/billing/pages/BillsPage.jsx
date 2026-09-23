import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getBills, collectPayment, getBillById, voidBill } from '../../../services/billService';
import { getPatients } from '../../../services/patientService';
import { getDoctors } from '../../../services/doctorService';
import { getAgents } from '../../../services/agentService';
import { getTests } from '../../../services/testService';
import { getPackages } from '../../../services/packageService';
import { downloadBillPdf, fetchBillQr, printBillPdf } from '../../../services/publicService';
import { DataTable, PageHeader, Button, StatusBadge, Select, AdvancedFilterBar, DURATION_OPTIONS } from '../../../components/common';
import { BILL_TABLE_HEADERS, BILL_STATUS_OPTIONS } from '../../../constants/billConstants';
export const CASE_TYPE_OPTIONS = ['LabCase','UsgCase','DigitalXrayCase','XrayCase','OutsourceLabCase','EcgCase','CtScanCase','MriCase','EpsCase','OpgCase','CardiologyCase','EegCase','MammographyCase'].map((v) => ({ value: v, label: v }));
import { DEPARTMENTS } from '../billingConstants';
import BillCreateForm from '../components/BillCreateForm';
import PaymentCollectModal from '../components/PaymentCollectModal';
import { LabelPrintSheet } from '../../../components/lab';
import VoidReasonDialog from '../components/VoidReasonDialog';
import { usePermissions } from '../../../hooks/usePermission';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';
import useAuth from '../../../hooks/useAuth';
import { Plus, Printer, CreditCard, Ban, QrCode, FileDown, Tag } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';

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

  // List view
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [adv, setAdv] = useState({ duration: 'Past 7 days', regNo: '', firstName: '', referredBy: '', collectionCentre: '', agent: '', hasDue: false, cancelled: false, caseType: '', uhid: '', dailyCaseNo: '' });
  const setAdvKey = (k, v) => { setAdv((p) => ({ ...p, [k]: v })); };

  // Modals
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetBill, setPaymentTargetBill] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentSubmitLoading, setPaymentSubmitLoading] = useState(false);

  const [voidTarget, setVoidTarget] = useState(null);
  const [voidLoading, setVoidLoading] = useState(false);

  // Phase 8 + 11 — label / sticker printing per bill.
  const [labelTarget, setLabelTarget] = useState(null);
  const [payError, setPayError] = useState('');
  const { can } = usePermissions();
  const canBill = can('billing');

  const fetchBillsList = async () => {
    setLoading(true);
    try {
      const res = await getBills({
        search: debouncedSearch || undefined,
        paymentStatus: filterStatus || undefined,
        department: filterDept || undefined,
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
        page, limit
      });
      if (res.success) {
        setBills(res.data.bills);
        setPaginationInfo(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load bills', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormOptions = async () => {
    try {
      const [patRes, docRes, agentRes, testRes, pkgRes] = await Promise.all([
        getPatients({ limit: 100 }),
        getDoctors({ status: 'Active' }),
        getAgents({ status: 'Active' }),
        getTests({ status: 'Active' }),
        getPackages()
      ]);
      if (patRes.success) setPatients(patRes.data.patients);
      if (docRes.success) setDoctors(docRes.data);
      if (agentRes.success) setAgents(agentRes.data);
      if (testRes.success) setTests(testRes.data);
      if (pkgRes.success) setPackages(pkgRes.data);
    } catch (err) {
      console.error('Failed to fetch form options', err);
    }
  };

  useEffect(() => {
    if (!isCreateView) {
      fetchBillsList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterStatus, filterDept, page, limit, isCreateView, adv.duration, adv.referredBy, adv.collectionCentre, adv.agent, adv.hasDue, adv.cancelled, adv.caseType]);

  useEffect(() => {
    fetchFormOptions();
    const querySearch = searchParams.get('search');
    if (querySearch) setSearch(querySearch);
  }, []);

  const handleOpenPayment = (bill) => {
    setPaymentTargetBill(bill);
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
    if (amt > Number(paymentTargetBill.dueAmount)) {
      setPayError(`Amount cannot exceed the due balance (${paymentTargetBill.dueAmount}).`);
      return;
    }
    if (!paymentMethod) {
      setPayError('Payment mode is required.');
      return;
    }
    setPayError('');
    setPaymentSubmitLoading(true);
    try {
      const res = await collectPayment(paymentTargetBill._id, { amount: paymentAmount, paymentMethod });
      if (res.success) {
        setPaymentModalOpen(false);
        fetchBillsList();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Payment collection failed');
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
    setVoidLoading(true);
    try {
      const res = await voidBill(voidTarget._id, String(reason).trim());
      if (res.success) {
        setVoidTarget(null);
        fetchBillsList();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to void bill');
    } finally {
      setVoidLoading(false);
    }
  };

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
      <BillCreateForm
        patients={patients}
        doctors={doctors}
        agents={agents}
        tests={tests}
        packages={packages}
        onBillCreated={fetchBillsList}
      />
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
        Refunds and post-payment bill edits are disabled — no backend endpoints exist for them.
      </p>

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
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage
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
            <td><StatusBadge status={bill.paymentStatus} /></td>
            <td>{formatDate(bill.date)}</td>
            <td>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
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
                <Button variant="secondary" size="sm" disabled title="No backend endpoint exists for refunds">
                  Refund
                </Button>
                <Button variant="secondary" size="sm" disabled title="No backend endpoint exists for editing a bill after payment">
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
        error={payError}
      />

      <LabelPrintSheet
        isOpen={!!labelTarget}
        onClose={() => setLabelTarget(null)}
        patient={labelTarget?.patient}
        bill={labelTarget}
      />

      <VoidReasonDialog
        isOpen={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        bill={voidTarget}
        onConfirm={handleVoidConfirm}
        loading={voidLoading}
      />
    </div>
  );
};

export default BillsPage;
