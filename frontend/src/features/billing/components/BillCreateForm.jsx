import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBill } from '../../../services/billService';
import { createPatient } from '../../../services/patientService';
import { PageHeader, Button } from '../../../components/common';
import PatientDetailsSection from './PatientDetailsSection';
import DepartmentSelector from './DepartmentSelector';
import BillItemsTable from './BillItemsTable';
import PaymentSummarySection from './PaymentSummarySection';
import { filterTestsByDepartment } from '../billingConstants';
import { Select } from '../../../components/common';
import { ArrowLeft, Plus } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
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

const EMPTY_PATIENT_FORM = {
  isExistingPatient: true,
  selectedPatientId: '',
  patientPhone: '',
  patientTitle: 'Mr.',
  patientFirstName: '',
  patientLastName: '',
  patientGender: 'Male',
  patientAgeYears: '',
  patientAgeMonths: '',
  patientAgeDays: '',
  onlineReportRequested: false,
  showEmail: false,
  showAddress: false,
  showAadhaar: false,
  showHistory: false,
  patientEmail: '',
  patientAddress: '',
  patientAadhaar: '',
  patientHistory: ''
};

const BillCreateForm = ({
  patients = [],
  doctors = [],
  agents = [],
  tests = [],
  packages = [],
  panels = [],
  onBillCreated
}) => {
  const navigate = useNavigate();

  const [patientForm, setPatientForm] = useState(EMPTY_PATIENT_FORM);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [activeDepartment, setActiveDepartment] = useState('LAB');
  const [pickerType, setPickerType] = useState('Test');
  const [selectedItems, setSelectedItems] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const updatePatientForm = (field) => (val) =>
    setPatientForm((prev) => ({ ...prev, [field]: typeof val === 'function' ? val(prev[field]) : val }));

  const handlePatientSelect = (e) => {
    const id = e.target.value;
    setPatientForm((prev) => ({ ...prev, selectedPatientId: id }));
    const pat = patients.find((p) => p._id === id);
    if (pat) {
      const nameParts = pat.name.split(' ');
      setPatientForm((prev) => ({
        ...prev,
        selectedPatientId: id,
        patientPhone: pat.phone,
        patientFirstName: nameParts[0] || '',
        patientLastName: nameParts.slice(1).join(' ') || '',
        patientGender: pat.gender || 'Male',
        patientAgeYears: String(pat.age || ''),
        patientAgeMonths: '',
        patientAgeDays: '',
        ...(pat.email ? { patientEmail: pat.email, showEmail: true } : {}),
        ...(pat.address ? { patientAddress: pat.address, showAddress: true } : {})
      }));
    }
  };

  const handleAddItem = (item, type) => {
    const alreadyAdded = selectedItems.some(
      (si) => si.itemId === item._id && si.itemType === type
    );
    if (alreadyAdded) return;
    setSelectedItems((prev) => [...prev, { itemId: item._id, itemType: type, name: item.name, price: item.price }]);
  };

  const subtotal = selectedItems.reduce((s, item) => s + item.price, 0);
  const discountAmount = Math.max(0, (subtotal * discountPercent) / 100);
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  const validate = () => {
    const errs = {};
    if (patientForm.isExistingPatient && !patientForm.selectedPatientId) {
      errs.patient = 'Please choose a patient profile';
    }
    if (!patientForm.isExistingPatient) {
      if (!patientForm.patientFirstName.trim()) errs.firstName = 'First name is required';
      if (!patientForm.patientPhone.trim()) errs.phone = 'Phone is required';
      if (!patientForm.patientAgeYears) errs.age = 'Age is required';
    }
    if (selectedItems.length === 0) errs.items = 'Please select at least one test or package';
    if (paidAmount < 0 || paidAmount > totalAmount) errs.paidAmount = 'Paid amount cannot exceed total';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      let patientId = patientForm.selectedPatientId;

      if (!patientForm.isExistingPatient) {
        const patientPayload = {
          name: `${patientForm.patientTitle} ${patientForm.patientFirstName} ${patientForm.patientLastName}`.trim(),
          phone: patientForm.patientPhone,
          gender: patientForm.patientGender,
          age: Number(patientForm.patientAgeYears),
          address: patientForm.showAddress ? patientForm.patientAddress : 'Registered Inline',
          ...(patientForm.showEmail ? { email: patientForm.patientEmail } : {})
        };
        const patRes = await createPatient(patientPayload);
        if (!patRes.success) throw new Error('Failed to auto-register patient');
        patientId = patRes.data._id;
      }

      const res = await createBill({
        patient: patientId,
        referringDoctor: selectedDoctor || null,
        agent: selectedAgent || null,
        items: selectedItems,
        discount: discountAmount,
        paidAmount,
        paymentMethod,
        department: activeDepartment
      });

      if (res.success) {
        onBillCreated?.();
        navigate('/cases/bills');
      }
    } catch (err) {
      setErrors({ api: getApiErrorMessage(err, 'Failed to generate invoice') });
    } finally {
      setSubmitting(false);
    }
  };

  const departmentTests = filterTestsByDepartment(tests, activeDepartment);

  // Picker source per active tab — every price comes from the existing
  // catalog APIs (tests / packages / panels); nothing is priced in frontend
  // constants, and all three types are accepted by the bill validator.
  const pickerSource =
    pickerType === 'TestPackage' ? packages : pickerType === 'TestPanel' ? panels : departmentTests;
  const pickerItems = Array.isArray(pickerSource) ? pickerSource : [];
  const pickerEmptyText =
    pickerType === 'Test'
      ? `No tests mapped under ${activeDepartment}`
      : pickerType === 'TestPackage'
        ? 'No packages available.'
        : 'No panels available.';

  return (
    <div>
      <Button
        variant="secondary"
        onClick={() => navigate('/cases/bills')}
        icon={<ArrowLeft size={16} />}
        style={{ marginBottom: 'var(--space-5)' }}
      >
        Back to Ledger
      </Button>

      <PageHeader
        title="Create Bill Invoice"
        subtitle="Record diagnostic orders and invoice payments"
      />

      {errors.api && (
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-4)'
          }}
        >
          {errors.api}
        </div>
      )}

      <div className="bill-form-grid">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <PatientDetailsSection
            isExistingPatient={patientForm.isExistingPatient}
            setIsExistingPatient={(v) => setPatientForm((p) => ({ ...p, isExistingPatient: v }))}
            patients={patients}
            selectedPatientId={patientForm.selectedPatientId}
            onPatientSelect={handlePatientSelect}
            patientPhone={patientForm.patientPhone}
            setPatientPhone={(v) => setPatientForm((p) => ({ ...p, patientPhone: v }))}
            patientTitle={patientForm.patientTitle}
            setPatientTitle={(v) => setPatientForm((p) => ({ ...p, patientTitle: v }))}
            patientFirstName={patientForm.patientFirstName}
            setPatientFirstName={(v) => setPatientForm((p) => ({ ...p, patientFirstName: v }))}
            patientLastName={patientForm.patientLastName}
            setPatientLastName={(v) => setPatientForm((p) => ({ ...p, patientLastName: v }))}
            patientGender={patientForm.patientGender}
            setPatientGender={(v) => setPatientForm((p) => ({ ...p, patientGender: v }))}
            patientAgeYears={patientForm.patientAgeYears}
            setPatientAgeYears={(v) => setPatientForm((p) => ({ ...p, patientAgeYears: v }))}
            patientAgeMonths={patientForm.patientAgeMonths}
            setPatientAgeMonths={(v) => setPatientForm((p) => ({ ...p, patientAgeMonths: v }))}
            patientAgeDays={patientForm.patientAgeDays}
            setPatientAgeDays={(v) => setPatientForm((p) => ({ ...p, patientAgeDays: v }))}
            onlineReportRequested={patientForm.onlineReportRequested}
            setOnlineReportRequested={(v) => setPatientForm((p) => ({ ...p, onlineReportRequested: v }))}
            showEmail={patientForm.showEmail}
            setShowEmail={(fn) => setPatientForm((p) => ({ ...p, showEmail: typeof fn === 'function' ? fn(p.showEmail) : fn }))}
            showAddress={patientForm.showAddress}
            setShowAddress={(fn) => setPatientForm((p) => ({ ...p, showAddress: typeof fn === 'function' ? fn(p.showAddress) : fn }))}
            showAadhaar={patientForm.showAadhaar}
            setShowAadhaar={(fn) => setPatientForm((p) => ({ ...p, showAadhaar: typeof fn === 'function' ? fn(p.showAadhaar) : fn }))}
            showHistory={patientForm.showHistory}
            setShowHistory={(fn) => setPatientForm((p) => ({ ...p, showHistory: typeof fn === 'function' ? fn(p.showHistory) : fn }))}
            patientEmail={patientForm.patientEmail}
            setPatientEmail={(v) => setPatientForm((p) => ({ ...p, patientEmail: v }))}
            patientAddress={patientForm.patientAddress}
            setPatientAddress={(v) => setPatientForm((p) => ({ ...p, patientAddress: v }))}
            patientAadhaar={patientForm.patientAadhaar}
            setPatientAadhaar={(v) => setPatientForm((p) => ({ ...p, patientAadhaar: v }))}
            patientHistory={patientForm.patientHistory}
            setPatientHistory={(v) => setPatientForm((p) => ({ ...p, patientHistory: v }))}
            errors={errors}
          />

          {/* Case Details Card */}
          <div className="bill-form-card">
            <div className="bill-card-header">
              <div className="bill-card-header-left">
                <span className="bill-card-step-badge">2</span>
                <h3 className="bill-card-title">Case Details</h3>
              </div>
            </div>

            {/* Referred By */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                <label className="form-label" style={{ margin: 0 }}>Referred By</label>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 'var(--font-size-xs)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => navigate('/cases/doctors')}
                >
                  <Plus size={12} /> Add Doctor
                </button>
              </div>
              <Select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                options={doctors.map((d) => ({ value: d._id, label: d.name }))}
                placeholder="Self / Walk-in"
              />
            </div>

            {/* Agent */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                <label className="form-label" style={{ margin: 0 }}>Collection Agent</label>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 'var(--font-size-xs)', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => navigate('/cases/agents')}
                >
                  + Add Agent
                </button>
              </div>
              <Select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                options={agents.map((a) => ({ value: a._id, label: a.name }))}
                placeholder="None"
              />
            </div>

            {/* Department Selector */}
            <DepartmentSelector activeDepartment={activeDepartment} onSelect={setActiveDepartment} />

            {/* Service picker — department-filtered tests plus packages and
                panels, all from the existing catalog APIs with server rates. */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                Select services
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <Button variant={pickerType === 'Test' ? 'primary' : 'secondary'} size="sm" onClick={() => setPickerType('Test')}>
                  Tests
                </Button>
                <Button variant={pickerType === 'TestPackage' ? 'primary' : 'secondary'} size="sm" onClick={() => setPickerType('TestPackage')}>
                  Packages
                </Button>
                <Button variant={pickerType === 'TestPanel' ? 'primary' : 'secondary'} size="sm" onClick={() => setPickerType('TestPanel')}>
                  Panels
                </Button>
              </div>
              <div className="test-picker-list">
                {pickerItems.length === 0 ? (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-5)' }}>
                    {pickerEmptyText}
                  </p>
                ) : (
                  pickerItems.map((item) => (
                    <div
                      key={item._id}
                      className="test-picker-item"
                      onClick={() => handleAddItem(item, pickerType)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(item, pickerType); }}
                    >
                      <span>
                        {item.name}
                        {item.code ? ` (${item.code})` : ''}
                      </span>
                      <strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(item.price)}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="bill-form-card">
            <BillItemsTable
              items={selectedItems}
              onRemove={(idx) => setSelectedItems((prev) => prev.filter((_, i) => i !== idx))}
              error={errors.items}
            />
          </div>

          <PaymentSummarySection
            subtotal={subtotal}
            discountPercent={discountPercent}
            setDiscountPercent={setDiscountPercent}
            paidAmount={paidAmount}
            setPaidAmount={setPaidAmount}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            totalAmount={totalAmount}
            dueAmount={dueAmount}
            errors={errors}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </div>
      </div>
    </div>
  );
};

export default BillCreateForm;
