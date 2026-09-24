import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBill, collectPayment, getBillById } from '../../../services/billService';
import { createPatient } from '../../../services/patientService';
import { PageHeader, Button } from '../../../components/common';
import { TestCombobox } from '../../../components/common';
import PatientDetailsSection from './PatientDetailsSection';
import DepartmentSelector from './DepartmentSelector';
import BillItemsTable from './BillItemsTable';
import PaymentSummarySection from './PaymentSummarySection';
import PackageSelector from './PackageSelector';
import ComboIndicator from './ComboIndicator';
import { filterTestsByDepartment, DEPT_TO_CASE_TYPE } from '../billingConstants';
import { Select } from '../../../components/common';
import { ArrowLeft, Plus } from 'lucide-react';
import '../Billing.css';

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
  onBillCreated
}) => {
  const navigate = useNavigate();

  const [patientForm, setPatientForm] = useState(EMPTY_PATIENT_FORM);
  // Full picked patient object (may come from server search beyond the
  // preloaded first-100 list, so it can't be re-derived from `patients`).
  const [pickedPatient, setPickedPatient] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [activeDepartment, setActiveDepartment] = useState('LAB');
  const [selectedItems, setSelectedItems] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const updatePatientForm = (field) => (val) =>
    setPatientForm((prev) => ({ ...prev, [field]: typeof val === 'function' ? val(prev[field]) : val }));

  const handlePatientSelect = (pat) => {
    if (!pat) {
      setPickedPatient(null);
      setPatientForm((prev) => ({ ...prev, selectedPatientId: '' }));
      return;
    }
    setPickedPatient(pat);
    const nameParts = String(pat.name || '').split(' ');
    setPatientForm((prev) => ({
      ...prev,
      selectedPatientId: pat._id,
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
  };

  const handleAddItem = (item, type) => {
    const alreadyAdded = selectedItems.some(
      (si) => si.itemId === item._id && si.itemType === type
    );
    if (alreadyAdded) return;
    setSelectedItems((prev) => [...prev, { itemId: item._id, itemType: type, name: item.name, price: item.price }]);
  };

  // Phase 22 — package/panel selection at bundle pricing. The bundle is
  // added as one priced line (package total replaces individual rates);
  // member test names are kept for the on-screen + printed breakdown.
  const handleSelectBundle = (bundle, kind) => {
    const itemType = kind === 'panels' ? 'Panel' : 'Package';
    const alreadyAdded = selectedItems.some(
      (si) => si.itemId === bundle._id && si.itemType === itemType
    );
    if (alreadyAdded) return;
    const members = bundle.includedTests || bundle.tests || [];
    const memberNames = members.map((m) => (typeof m === 'string' ? m : (m.name || m.code || ''))).filter(Boolean);
    setSelectedItems((prev) => [...prev, {
      itemId: bundle._id,
      itemType,
      name: `${bundle.name} (bundle)`,
      price: Number(bundle.price) || 0,
      comboName: bundle.name,
      comboId: bundle._id,
      comboMembers: memberNames,
    }]);
  };

  const selectedBundleIds = selectedItems
    .filter((i) => i.itemType === 'Package' || i.itemType === 'Panel')
    .map((i) => i.itemId);

  const subtotal = selectedItems.reduce((s, item) => s + item.price, 0);
  const discountAmount = Math.max(0, Math.min(subtotal, (subtotal * discountPercent) / 100));
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
    if (discountPercent < 0 || discountPercent > 100) errs.discount = 'Discount must be between 0 and 100%.';
    if (discountAmount > subtotal) errs.discount = 'Discount cannot exceed the subtotal.';
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

      // Courtesy guard: 200 bills/day soft limit (§10)
      const res = await createBill({
        patient: patientId,
        referringDoctor: selectedDoctor || null,
        agent: selectedAgent || null,
        items: selectedItems,
        discount: discountAmount,
        paidAmount,
        paymentMethod,
        department: activeDepartment,
        caseType: DEPT_TO_CASE_TYPE[activeDepartment] || 'LabCase',
        collectionCentre: 'Main',
        onlineReportRequested: patientForm.onlineReportRequested,
        discountPercent: discountPercent > 0
      });

      if (res.success) {
        onBillCreated?.();
        navigate('/cases/bills');
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to generate invoice' });
    } finally {
      setSubmitting(false);
    }
  };

  const departmentTests = filterTestsByDepartment(tests, activeDepartment);

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
            setIsExistingPatient={(v) => setPatientForm((p) => ({ ...p, isExistingPatient: typeof v === 'function' ? v(p.isExistingPatient) : v }))}
            patients={patients}
            selectedPatientId={patientForm.selectedPatientId}
            selectedPatient={pickedPatient || patients.find((p) => p._id === patientForm.selectedPatientId) || null}
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

            {/* Package / Panel Picker (Phase 22 — wired to getPanels/getPackages) */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                Select Packages / Panels
              </label>
              <PackageSelector onSelect={handleSelectBundle} selectedIds={selectedBundleIds} />
            </div>

            {/* Test Picker — Phase 12 smart combobox + legacy clickable list */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <TestCombobox
                label="Quick add test"
                placeholder="Type code / name / department / price…"
                onSelect={(test) => handleAddItem(test, 'Test')}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                Select Tests / Scans
              </label>
              <div className="test-picker-list">
                {departmentTests.length === 0 ? (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-5)' }}>
                    No tests mapped under {activeDepartment}
                  </p>
                ) : (
                  departmentTests.map((test) => (
                    <div
                      key={test._id}
                      className="test-picker-item"
                      onClick={() => handleAddItem(test, 'Test')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(test, 'Test'); }}
                    >
                      <span>{test.name} ({test.code})</span>
                      <strong style={{ color: 'var(--color-primary)' }}>{test.price}</strong>
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
            <ComboIndicator items={selectedItems} />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0 }}>
              Printed bill note: the server-rendered bill PDF lists each line item and the bill
              discount — bundle members above are itemised at the package total.
            </p>
          </div>

          <PaymentSummarySection
            subtotal={subtotal}
            discountPercent={discountPercent}
            setDiscountPercent={setDiscountPercent}
            paidAmount={paidAmount}
            setPaidAmount={setPaidAmount}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            remarks={remarks}
            setRemarks={setRemarks}
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
