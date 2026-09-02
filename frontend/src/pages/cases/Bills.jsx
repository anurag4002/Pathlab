import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, NavLink } from 'react-router-dom';
import { getBills, createBill, collectPayment, getBillById } from '../../services/billService';
import { getPatients, createPatient } from '../../services/patientService';
import { getDoctors } from '../../services/doctorService';
import { getAgents } from '../../services/agentService';
import { getTests } from '../../services/testService';
import { getPackages } from '../../services/packageService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { BILL_TABLE_HEADERS, PAYMENT_METHODS, BILL_STATUS_OPTIONS } from '../../constants/billConstants';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import {
import { DataTable, PageHeader, Button, Modal, Input, Select, StatusBadge } from '../../components/common';
  Plus, Trash2, Search, ArrowLeft, Printer, CreditCard,
  FlaskConical, Activity, Image as ImageIcon, FileImage, ExternalLink,
  HeartPulse, Layers, Scan, Zap, Smile, Heart, Brain, RefreshCw
} from 'lucide-react';

const DEPARTMENTS = [
  { name: 'LAB', icon: FlaskConical },
  { name: 'USG', icon: Activity },
  { name: 'DIGITAL XRAY', icon: ImageIcon },
  { name: 'XRAY', icon: FileImage },
  { name: 'OUTSOURCE LAB', icon: ExternalLink },
  { name: 'ECG', icon: HeartPulse },
  { name: 'CT SCAN', icon: Layers },
  { name: 'MRI', icon: Scan },
  { name: 'EPS', icon: Zap },
  { name: 'OPG', icon: Smile },
  { name: 'CARDIOLOGY', icon: Heart },
  { name: 'EEG', icon: Brain },
  { name: 'MAMMOGRAPHY', icon: Activity }
];

const Bills = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef(null);
  const location = useLocation();

  // Toggle list vs create view
  const [view, setView] = useState(location.pathname.endsWith('/new') ? 'create' : 'list');

  useEffect(() => {
    if (location.pathname.endsWith('/new')) {
      setView('create');
    } else {
      setView('list');
    }
  }, [location.pathname]);
  
  // Data list states
  const [bills, setBills] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [agents, setAgents] = useState([]);
  const [tests, setTests] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Pagination
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const { page, limit, goToPage } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });
  const [filterStatus, setFilterStatus] = useState('');

  // ==========================================
  // BILLING FORM STATE
  // ==========================================
  const [isExistingPatient, setIsExistingPatient] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  
  // Patient details inputs
  const [patientPhone, setPatientPhone] = useState('');
  const [patientTitle, setPatientTitle] = useState('Mr.');
  const [patientFirstName, setPatientFirstName] = useState('');
  const [patientLastName, setPatientLastName] = useState('');
  const [patientGender, setPatientGender] = useState('Male'); // 'Male' | 'Female' | 'Other'
  const [patientAgeYears, setPatientAgeYears] = useState('');
  const [patientAgeMonths, setPatientAgeMonths] = useState('');
  const [patientAgeDays, setPatientAgeDays] = useState('');
  const [onlineReportRequested, setOnlineReportRequested] = useState(false);

  // Optional Patient Detail Fields Toggles
  const [showEmail, setShowEmail] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [patientEmail, setPatientEmail] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [patientAadhaar, setPatientAadhaar] = useState('');
  const [patientHistory, setPatientHistory] = useState('');

  // Case details inputs
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [activeDepartment, setActiveDepartment] = useState('LAB');

  // Items Selection
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Payment Details
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  
  const [billErrors, setBillErrors] = useState({});
  const [billSubmitLoading, setBillSubmitLoading] = useState(false);

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetBill, setPaymentTargetBill] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethodSelect, setPaymentMethodSelect] = useState('Cash');
  const [paymentSubmitLoading, setPaymentSubmitLoading] = useState(false);

  // Print Invoice State
  const [activePrintBill, setActivePrintBill] = useState(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const fetchBillsList = async () => {
    setLoading(true);
    try {
      const res = await getBills({
        search: debouncedSearch,
        paymentStatus: filterStatus,
        page,
        limit
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
      const [patRes, docRes, ageRes, testRes, pkgRes] = await Promise.all([
        getPatients({ limit: 100 }),
        getDoctors({ status: 'Active' }),
        getAgents({ status: 'Active' }),
        getTests({ status: 'Active' }),
        getPackages()
      ]);

      if (patRes.success) setPatients(patRes.data.patients);
      if (docRes.success) setDoctors(docRes.data);
      if (ageRes.success) setAgents(ageRes.data);
      if (testRes.success) setTests(testRes.data);
      if (pkgRes.success) setPackages(pkgRes.data);
    } catch (err) {
      console.error('Failed to fetch options', err);
    }
  };

  useEffect(() => {
    if (view === 'list') {
      fetchBillsList();
    }
  }, [debouncedSearch, filterStatus, page, limit, view]);

  useEffect(() => {
    fetchFormOptions();
    const querySearch = searchParams.get('search');
    if (querySearch) {
      setSearch(querySearch);
    }
  }, [searchParams]);

  // When patient is picked, populate inputs automatically
  const handlePatientSelectChange = (e) => {
    const id = e.target.value;
    setSelectedPatientId(id);
    const pat = patients.find(p => p._id === id);
    if (pat) {
      setPatientPhone(pat.phone);
      const nameParts = pat.name.split(' ');
      setPatientFirstName(nameParts[0] || '');
      setPatientLastName(nameParts.slice(1).join(' ') || '');
      setPatientGender(pat.gender || 'Male');
      setPatientAgeYears(String(pat.age || ''));
      setPatientAgeMonths('');
      setPatientAgeDays('');
      if (pat.email) {
        setPatientEmail(pat.email);
        setShowEmail(true);
      }
      if (pat.address) {
        setPatientAddress(pat.address);
        setShowAddress(true);
      }
    }
  };

  const handleOpenCreate = () => {
    setIsExistingPatient(true);
    setSelectedPatientId('');
    setPatientPhone('');
    setPatientFirstName('');
    setPatientLastName('');
    setPatientGender('Male');
    setPatientAgeYears('');
    setPatientAgeMonths('');
    setPatientAgeDays('');
    setOnlineReportRequested(false);
    setShowEmail(false);
    setShowAddress(false);
    setShowAadhaar(false);
    setShowHistory(false);
    setPatientEmail('');
    setPatientAddress('');
    setPatientAadhaar('');
    setPatientHistory('');
    setSelectedDoctor('');
    setSelectedAgent('');
    setSelectedItems([]);
    setDiscountPercent(0);
    setPaidAmount(0);
    setPaymentMethod('Cash');
    setRemarks('');
    setBillErrors({});
    setView('create');
  };

  const handleAddItem = (item, type) => {
    const isAlreadyAdded = selectedItems.some(si => si.itemId === item._id && si.itemType === type);
    if (isAlreadyAdded) return;

    setSelectedItems(prev => [
      ...prev,
      {
        itemId: item._id,
        itemType: type,
        name: item.name,
        price: item.price
      }
    ]);
  };

  const handleRemoveItem = (idx) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Filter tests by active department
  const getFilteredDepartmentTests = () => {
    if (activeDepartment === 'LAB') {
      return tests.filter(t => 
        !t.name.toLowerCase().includes('usg') && 
        !t.name.toLowerCase().includes('xray') &&
        !t.name.toLowerCase().includes('x-ray') &&
        !t.category?.name?.toLowerCase().includes('usg') &&
        !t.category?.name?.toLowerCase().includes('xray')
      );
    }
    if (activeDepartment === 'USG') {
      return tests.filter(t => 
        t.name.toLowerCase().includes('usg') || 
        t.name.toLowerCase().includes('ultrasound') ||
        t.category?.name?.toLowerCase().includes('usg')
      );
    }
    if (activeDepartment === 'DIGITAL XRAY' || activeDepartment === 'XRAY') {
      return tests.filter(t => 
        t.name.toLowerCase().includes('xray') || 
        t.name.toLowerCase().includes('x-ray') ||
        t.name.toLowerCase().includes('radiograph') ||
        t.category?.name?.toLowerCase().includes('xray')
      );
    }
    return [];
  };

  // Compute values
  const subtotal = selectedItems.reduce((sum, item) => sum + item.price, 0);
  const discountAmount = Math.max(0, (subtotal * discountPercent) / 100);
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  const validateBillForm = () => {
    const errs = {};
    if (isExistingPatient && !selectedPatientId) {
      errs.patient = 'Please choose a patient profile';
    }
    if (!isExistingPatient) {
      if (!patientFirstName.trim()) errs.firstName = 'First name is required';
      if (!patientPhone.trim()) errs.phone = 'Phone number is required';
      if (!patientAgeYears) errs.age = 'Age is required';
    }
    if (selectedItems.length === 0) errs.items = 'Please select at least one test or package';
    if (discountPercent < 0 || discountPercent > 100) errs.discount = 'Invalid discount percentage';
    if (paidAmount < 0 || paidAmount > totalAmount) errs.paidAmount = 'Paid amount cannot exceed total';
    setBillErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateBillSubmit = async () => {
    if (!validateBillForm()) return;
    setBillSubmitLoading(true);
    try {
      let patientId = selectedPatientId;

      // Register new patient first if inline details were entered
      if (!isExistingPatient) {
        const patientPayload = {
          name: `${patientTitle} ${patientFirstName} ${patientLastName}`.trim(),
          phone: patientPhone,
          gender: patientGender,
          age: Number(patientAgeYears),
          address: showAddress ? patientAddress : 'Registered Inline'
        };
        if (showEmail) patientPayload.email = patientEmail;
        
        const patientRes = await createPatient(patientPayload);
        if (patientRes.success) {
          patientId = patientRes.data._id;
        } else {
          throw new Error('Failed to auto-register patient profile');
        }
      }

      const payload = {
        patient: patientId,
        referringDoctor: selectedDoctor || null,
        agent: selectedAgent || null,
        items: selectedItems,
        discount: discountAmount,
        paidAmount,
        paymentMethod
      };

      const res = await createBill(payload);
      if (res.success) {
        setView('list');
        navigate('/cases/bills');
      }
    } catch (err) {
      setBillErrors({ api: err.response?.data?.message || 'Failed to generate invoice' });
    } finally {
      setBillSubmitLoading(false);
    }
  };

  const handleOpenPayment = (bill) => {
    setPaymentTargetBill(bill);
    setPaymentAmount(bill.dueAmount);
    setPaymentMethodSelect('Cash');
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (paymentAmount <= 0 || paymentAmount > paymentTargetBill.dueAmount) {
      alert('Invalid payment amount');
      return;
    }

    setPaymentSubmitLoading(true);
    try {
      const res = await collectPayment(paymentTargetBill._id, {
        amount: paymentAmount,
        paymentMethod: paymentMethodSelect
      });
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

  const handleOpenPrint = async (bill) => {
    try {
      const res = await getBillById(bill._id);
      if (res.success) {
        setActivePrintBill(res.data);
        setPrintModalOpen(true);
      }
    } catch (err) {
      alert('Failed to load bill print layout');
    }
  };

  const triggerBrowserPrint = () => {
    window.print();
  };

  return (
    <div>
      {view === 'list' ? (
        // ==========================================
        // LIST VIEW
        // ==========================================
        <div>
          <PageHeader
            title="Billing Ledger"
            subtitle="Manage patient billing receipts and outstanding balances"
            action={
              <Button variant="primary" onClick={handleOpenCreate}>
                <Plus size={16} /> Create Bill
              </Button>
            }
          />

          <div style={{ display: 'flex', gap: '16px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <Select
              placeholder="All Payment Statuses"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                goToPage(1);
              }}
              options={BILL_STATUS_OPTIONS}
              style={{ minWidth: '200px', marginBottom: 0 }}
            />
          </div>

          <DataTable
            headers={BILL_TABLE_HEADERS}
            data={bills}
            loading={loading}
            emptyMessage="No billing records found."
            searchValue={search}
            onSearchChange={(e) => {
              setSearch(e.target.value);
              goToPage(1);
            }}
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
                <td style={{ fontWeight: '600' }}>{bill.billNumber}</td>
                <td>{bill.patient?.name || 'Walk-in Patient'}</td>
                <td style={{ fontWeight: '600' }}>{formatCurrency(bill.totalAmount)}</td>
                <td style={{ color: 'var(--color-success)', fontWeight: '600' }}>
                  {formatCurrency(bill.paidAmount)}
                </td>
                <td style={{ color: bill.dueAmount > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: '600' }}>
                  {formatCurrency(bill.dueAmount)}
                </td>
                <td>
                  <StatusBadge status={bill.paymentStatus} />
                </td>
                <td>{formatDate(bill.date)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleOpenPrint(bill)}
                    >
                      <Printer size={14} /> Print
                    </button>
                    {bill.dueAmount > 0 && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => handleOpenPayment(bill)}
                      >
                        <CreditCard size={14} /> Pay
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      ) : (
        // ==========================================
        // CREATE BILL VIEW
        // ==========================================
        <div>
          <button className="btn btn-secondary" onClick={() => { setView('list'); navigate('/cases/bills'); }} style={{ marginBottom: '1.5rem' }}>
            <ArrowLeft size={16} /> Back to Ledger
          </button>

          <PageHeader
            title="Create Bill Invoice"
            subtitle="Record medical diagnostics, order lines, and invoice payments"
          />

          {billErrors.api && (
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--border-radius-sm)', marginBottom: '1.5rem' }}>
              {billErrors.api}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            
            {/* Left Box: Patient & References Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Patient Details Sub-Card */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--border-color)',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      fontWeight: '700'
                    }}>
                      1
                    </span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Patient details</h3>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    onClick={() => setIsExistingPatient(!isExistingPatient)}
                  >
                    {isExistingPatient ? 'Register New' : 'Select Existing'}
                  </button>
                </div>

                {isExistingPatient ? (
                  <Select
                    label="Search Registered Patients"
                    value={selectedPatientId}
                    onChange={handlePatientSelectChange}
                    options={patients.map(p => ({ value: p._id, label: `${p.name} (${p.phone})` }))}
                    error={billErrors.patient}
                    placeholder="Choose patient profile..."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Mobile Number search style */}
                    <div className="form-group" style={{ position: 'relative', marginBottom: 0 }}>
                      <label className="form-label">Mobile number</label>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ padding: '0 10px', border: '1px solid var(--border-color)', borderRight: 'none', background: 'var(--bg-main)', height: '40px', display: 'flex', alignItems: 'center', fontSize: '0.9rem', color: 'var(--text-muted)', borderRadius: '6px 0 0 6px' }}>+91</span>
                        <input
                          type="text"
                          className="form-control"
                          value={patientPhone}
                          onChange={(e) => setPatientPhone(e.target.value)}
                          placeholder="Phone number"
                          style={{ borderRadius: '0 6px 6px 0', height: '40px', flex: 1 }}
                        />
                      </div>
                      {billErrors.phone && <p style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginTop: '4px' }}>{billErrors.phone}</p>}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '80px' }}>
                        <Select
                          label="Title *"
                          value={patientTitle}
                          onChange={(e) => setPatientTitle(e.target.value)}
                          options={['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Baby'].map(t => ({ value: t, label: t }))}
                          style={{ marginBottom: 0 }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Input
                          label="First name *"
                          value={patientFirstName}
                          onChange={(e) => setPatientFirstName(e.target.value)}
                          error={billErrors.firstName}
                          placeholder="First Name"
                          style={{ marginBottom: 0 }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Input
                          label="Last name"
                          value={patientLastName}
                          onChange={(e) => setPatientLastName(e.target.value)}
                          placeholder="Last Name"
                          style={{ marginBottom: 0 }}
                        />
                      </div>
                    </div>

                    {/* Sex Toggle Buttons */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: '500', fontSize: '0.875rem' }}>Sex *</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {['Male', 'Female', 'Other'].map(g => (
                          <button
                            key={g}
                            type="button"
                            className={`btn ${patientGender === g ? 'btn-primary' : 'btn-secondary'}`}
                            style={{
                              flex: 1,
                              fontSize: '0.75rem',
                              padding: '10px 0',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              border: patientGender === g ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                              borderRadius: '6px'
                            }}
                            onClick={() => setPatientGender(g)}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Age split */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Age *</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <Input
                          type="number"
                          value={patientAgeYears}
                          onChange={(e) => setPatientAgeYears(e.target.value)}
                          error={billErrors.age}
                          placeholder="Years"
                          style={{ flex: 2, marginBottom: 0 }}
                        />
                        <Input
                          type="number"
                          value={patientAgeMonths}
                          onChange={(e) => setPatientAgeMonths(e.target.value)}
                          placeholder="Months"
                          style={{ flex: 1, marginBottom: 0 }}
                        />
                        <Input
                          type="number"
                          value={patientAgeDays}
                          onChange={(e) => setPatientAgeDays(e.target.value)}
                          placeholder="Days"
                          style={{ flex: 1, marginBottom: 0 }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', cursor: 'pointer', margin: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={onlineReportRequested}
                    onChange={(e) => setOnlineReportRequested(e.target.checked)}
                  />
                  <span>Online report requested (automatic email/sms findings link)</span>
                </label>

                {/* Additional Optional Details Badges */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setShowEmail(!showEmail)}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: showEmail ? 'var(--primary-light)' : '#ffffff',
                      color: showEmail ? 'var(--primary-color)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    + Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddress(!showAddress)}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: showAddress ? 'var(--primary-light)' : '#ffffff',
                      color: showAddress ? 'var(--primary-color)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    + Address
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAadhaar(!showAadhaar)}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: showAadhaar ? 'var(--primary-light)' : '#ffffff',
                      color: showAadhaar ? 'var(--primary-color)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    + Aadhaar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: showHistory ? 'var(--primary-light)' : '#ffffff',
                      color: showHistory ? 'var(--primary-color)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    + Patient history
                  </button>
                </div>

                {/* Optional inputs render */}
                {showEmail && (
                  <Input
                    label="Email address"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    placeholder="example@gmail.com"
                  />
                )}
                {showAddress && (
                  <Input
                    label="Home Address / City"
                    value={patientAddress}
                    onChange={(e) => setPatientAddress(e.target.value)}
                    placeholder="Address details"
                  />
                )}
                {showAadhaar && (
                  <Input
                    label="Aadhaar ID Card"
                    value={patientAadhaar}
                    onChange={(e) => setPatientAadhaar(e.target.value)}
                    placeholder="12-digit UID"
                  />
                )}
                {showHistory && (
                  <Input
                    label="Symptoms / Past History"
                    value={patientHistory}
                    onChange={(e) => setPatientHistory(e.target.value)}
                    placeholder="Cough, high sugar, fever, etc."
                  />
                )}

              </div>

              {/* Case Details Sub-Card */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: '700'
                  }}>
                    2
                  </span>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Case details</h3>
                </div>

                {/* Referred By */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Referred By *</label>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => navigate('/cases/doctors')}
                    >
                      <Plus size={12} /> Add New
                    </button>
                  </div>
                  <Select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    options={doctors.map(d => ({ value: d._id, label: d.name }))}
                    placeholder="Self / Walk-in"
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Collection centre"
                      value="Main"
                      onChange={() => {}}
                      options={[{ value: 'Main', label: 'Main Lab Centre' }]}
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Collection agent</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer' }}
                          onClick={() => navigate('/cases/agents')}
                        >
                          + Add new
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer' }}
                          onClick={() => navigate('/cases/agents')}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                    <Select
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      options={agents.map(a => ({ value: a._id, label: a.name }))}
                      placeholder="None"
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                </div>

                {/* Departments Filter Grid */}
                <div style={{ marginTop: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: '8px', fontWeight: '600' }}>Select Department Profile</label>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      paddingBottom: '8px',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border-color)'
                    }}
                  >
                    {DEPARTMENTS.map(dept => {
                      const IconComp = dept.icon;
                      const isActive = activeDepartment === dept.name;
                      return (
                        <button
                          key={dept.name}
                          type="button"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '10px 4px',
                            border: isActive ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                            color: isActive ? 'var(--primary-color)' : 'var(--text-main)',
                            backgroundColor: isActive ? 'var(--primary-light)' : '#ffffff',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            minWidth: '95px',
                            height: '68px',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => setActiveDepartment(dept.name)}
                        >
                          <IconComp size={18} />
                          <span>{dept.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tests List matching active department */}
                <div style={{ marginTop: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: '6px', fontWeight: '600' }}>Select Tests / Scans</label>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', maxHeight: '180px', overflowY: 'auto', padding: '6px', backgroundColor: '#ffffff' }}>
                    {getFilteredDepartmentTests().length === 0 ? (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>No tests mapped under {activeDepartment} department</p>
                    ) : (
                      getFilteredDepartmentTests().map(test => (
                        <div
                          key={test._id}
                          onClick={() => handleAddItem(test, 'Test')}
                          style={{ padding: '8px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}
                          className="test-selector-row"
                        >
                          <span>{test.name} ({test.code})</span>
                          <strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(test.price)}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Right Box: Draft Bill Calculation summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Selected Items Sub-Card */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', margin: 0 }}>
                  Selected Test Lines
                </h3>

                {billErrors.items && <p className="form-error">{billErrors.items}</p>}

                {/* Items Breakdown list */}
                <div style={{ flexGrow: 1, minHeight: '120px', maxHeight: '200px', overflowY: 'auto' }}>
                  {selectedItems.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                      No tests or packages selected.
                    </p>
                  ) : (
                    <table style={{ width: '100%', fontSize: '0.825rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '6px', textAlign: 'left' }}>Item Name</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Price</th>
                          <th style={{ padding: '6px', textAlign: 'center' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px' }}>{item.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({item.itemType})</span></td>
                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.price)}</td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Payment Details Form (Restructured styled exactly like screenshot) */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', margin: 0 }}>
                  Payment Details
                </h3>

                {/* Subtotal Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-main)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                  <span>Total: Rs.</span>
                  <strong>{subtotal}</strong>
                </div>

                {/* Discount */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.825rem' }}>Discount</label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="number"
                      className="form-control"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                      placeholder="0"
                      style={{ borderRadius: '6px 0 0 6px', height: '40px', flex: 1 }}
                    />
                    <span style={{ padding: '0 12px', border: '1px solid var(--border-color)', borderLeft: 'none', background: 'var(--primary-color)', color: '#ffffff', height: '40px', display: 'flex', alignItems: 'center', fontSize: '0.9rem', fontWeight: '700', borderRadius: '0 6px 6px 0' }}>%</span>
                  </div>
                </div>

                {/* Amount received */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.825rem' }}>Amount received</label>
                  <input
                    type="number"
                    className="form-control"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                    style={{ height: '40px' }}
                  />
                </div>

                {/* Balance */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', borderBottom: '1px dashed var(--border-color)', padding: '8px 0', fontSize: '0.9rem' }}>
                  <span>Balance: Rs.</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: dueAmount > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: '700' }}>
                      {dueAmount}
                    </strong>
                    <RefreshCw size={14} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setPaidAmount(totalAmount)} title="Collect Full Amount" />
                  </div>
                </div>

                {/* Mode Select */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.825rem' }}>Mode</label>
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
                    style={{ marginBottom: 0 }}
                  />
                </div>

                {/* Remarks */}
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ fontSize: '0.825rem' }}>Remarks</label>
                  <input
                    type="text"
                    className="form-control"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Remarks"
                    style={{ height: '40px' }}
                  />
                </div>

                {/* Create submit button */}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateBillSubmit}
                  disabled={selectedItems.length === 0 || billSubmitLoading}
                  style={{
                    width: '100%',
                    height: '42px',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    borderRadius: '6px',
                    backgroundColor: 'var(--primary-color)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {billSubmitLoading ? 'Saving...' : 'Create'}
                </button>

              </div>

            </div>

          </div>
        </div>
      )}

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
        <div>
          <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
            Invoice: <strong>{paymentTargetBill?.billNumber}</strong> | Remaining Due: <strong>{formatCurrency(paymentTargetBill?.dueAmount || 0)}</strong>
          </p>
          <Input
            label="Payment Amount Received"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(Math.max(0, Math.min(Number(e.target.value), paymentTargetBill.dueAmount)))}
            required
          />
          <Select
            label="Payment Method"
            value={paymentMethodSelect}
            onChange={(e) => setPaymentMethodSelect(e.target.value)}
            options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
            required
          />
        </div>
      </Modal>

      {/* Print Printable Invoice Modal */}
      <Modal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title="Invoice Print Preview"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPrintModalOpen(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={triggerBrowserPrint}>
              <Printer size={16} /> Print Document
            </Button>
          </>
        }
      >
        {activePrintBill && (
          <div ref={printRef} className="printable-area" style={{ padding: '16px', fontFamily: 'Courier, monospace', fontSize: '0.875rem', color: '#000' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img
                src="/logo.jpg"
                alt="Logo"
                style={{ width: '48px', height: '48px', borderRadius: '50%', marginBottom: '4px', objectFit: 'cover' }}
              />
              <h2 style={{ margin: 0, fontWeight: '700', fontSize: '1.25rem' }}>PURE PATH LAB</h2>
              <p style={{ margin: '2px 0' }}>Pathology & Diagnostic Center</p>
              <p style={{ margin: '2px 0', fontSize: '0.75rem' }}>Ph: +91 98765 43210 | Sector 15, Dwarka, New Delhi</p>
              <div style={{ borderBottom: '2px dashed #000', margin: '8px 0', width: '100%' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem', lineHeight: '1.4' }}>
              <div>
                <strong>Patient Name:</strong> {activePrintBill.patient?.name}<br />
                <strong>Age / Gender:</strong> {activePrintBill.patient?.age} Yrs / {activePrintBill.patient?.gender}<br />
                <strong>Reg Number:</strong> {activePrintBill.patient?.registrationNumber}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Bill Number:</strong> {activePrintBill.billNumber}<br />
                <strong>Date:</strong> {formatDate(activePrintBill.date)}<br />
                <strong>Doc Referral:</strong> {activePrintBill.referringDoctor?.name || 'Self'}
              </div>
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>

            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000' }}>
                  <th style={{ padding: '4px 0' }}>Test Description</th>
                  <th style={{ padding: '4px 0', textAlign: 'right' }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {activePrintBill.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '4px 0' }}>{item.name}</td>
                    <td style={{ padding: '4px 0', textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', lineHeight: '1.4' }}>
              <div>Gross Subtotal: {formatCurrency(activePrintBill.totalAmount + activePrintBill.discount)}</div>
              {activePrintBill.discount > 0 && <div>Discount Applied: -{formatCurrency(activePrintBill.discount)}</div>}
              <div style={{ fontWeight: '700' }}>Net Total Amount: {formatCurrency(activePrintBill.totalAmount)}</div>
              <div style={{ color: 'green' }}>Paid Amount: {formatCurrency(activePrintBill.paidAmount)}</div>
              {activePrintBill.dueAmount > 0 && (
                <div style={{ color: 'red', fontWeight: '700' }}>Due Balance: {formatCurrency(activePrintBill.dueAmount)}</div>
              )}
              <div>Payment Mode: {activePrintBill.paymentMethod}</div>
            </div>

            <div style={{ borderBottom: '2px dashed #000', margin: '1.5rem 0 0.5rem 0' }}></div>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', margin: 0 }}>*** Thank You for Choosing Pure Path Lab ***</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Bills;
