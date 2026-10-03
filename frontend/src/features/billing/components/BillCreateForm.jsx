import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createBill } from '../../../services/billService';
import { createPatient, getPatientById } from '../../../services/patientService';
import { getTests } from '../../../services/testService';
import { PageHeader, Button, Select } from '../../../components/common';
import PatientDetailsSection from './PatientDetailsSection';
import DepartmentSelector from './DepartmentSelector';
import BillItemsTable from './BillItemsTable';
import PaymentSummarySection from './PaymentSummarySection';
import ComboIndicator from './ComboIndicator';
import { filterTestsByDepartment, DEPT_TO_CASE_TYPE } from '../billingConstants';
import { ArrowLeft, Plus, ShoppingCart } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import '../Billing.css';

const matchesPickerQuery = (item, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${item.name || ''} ${item.code || ''} ${item.price ?? ''}`.toLowerCase();
  return q.split(/\s+/).every((tok) => hay.includes(tok));
};

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

// Module-scope booking handoff cache — survives StrictMode remounts within
// the same page load (both mount passes share the module instance).
let cachedBookingPrefill = null;
let cachedBookingRead = false;
const takeBookingPrefill = (fallback) => {
  if (!cachedBookingRead) {
    cachedBookingRead = true;
    try {
      const raw = sessionStorage.getItem('billBookingPrefill');
      if (raw) cachedBookingPrefill = JSON.parse(raw);
    } catch {
      /* storage unavailable — ignore */
    }
    if (!cachedBookingPrefill && fallback) cachedBookingPrefill = fallback;
  }
  return cachedBookingPrefill;
};
// Clears a consumed handoff so a later manual "Create Bill" starts empty.
export const clearBookingPrefill = () => {
  cachedBookingPrefill = null;
  try {
    sessionStorage.removeItem('billBookingPrefill');
  } catch {
    /* ignore */
  }
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
  const location = useLocation();
  // Prefill from a confirmed booking inquiry (Inquiries → "Confirm & Bill").
  // Handoff arrives via sessionStorage (survives URL-mirroring replaces and
  // refreshes); router state is accepted as a fallback. Read via the module
  // cache so React StrictMode's dev double-mount sees the same value on both
  // passes; cleared once the items are applied (see items effect below).
  const [bookingPrefill] = useState(() => takeBookingPrefill(location.state?.booking || null));

  const [patientForm, setPatientForm] = useState(EMPTY_PATIENT_FORM);
  const [bookingBanner, setBookingBanner] = useState('');
  const [unmatchedBookingItems, setUnmatchedBookingItems] = useState([]);
  // Discount mode: 'percent' (0–100%) or 'amount' (flat ₹). The %/₹ badge
  // in DiscountRow toggles between them; both values are preserved.
  const [discountMode, setDiscountMode] = useState('percent');
  // Full picked patient object (may come from server search beyond the
  // preloaded first-100 list, so it can't be re-derived from `patients`).
  const [pickedPatient, setPickedPatient] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [activeDepartment, setActiveDepartment] = useState('LAB');
  const [pickerType, setPickerType] = useState('Test');
  // One search box: filter local catalog first, then fall back to server (tests).
  const [pickerQuery, setPickerQuery] = useState('');
  const [serverResults, setServerResults] = useState([]);
  const [serverSearching, setServerSearching] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const cartRef = useRef(null);
  const flashTimerRef = useRef(null);

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

  const revealCart = () => {
    const el = cartRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.classList.add('bill-cart-flash');
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => el.classList.remove('bill-cart-flash'), 700);
  };

  const handleAddItem = (item, type) => {
    const alreadyAdded = selectedItems.some(
      (si) => si.itemId === item._id && si.itemType === type
    );
    if (alreadyAdded) return;
    setSelectedItems((prev) => [...prev, { itemId: item._id, itemType: type, name: item.name, price: item.price }]);
    requestAnimationFrame(revealCart);
  };

  // Phase 22 — package/panel selection at bundle pricing. The bundle is
  // added as one priced line (package total replaces individual rates);
  // member test names are kept for the on-screen + printed breakdown.
  const handleSelectBundle = (bundle, kind) => {
    const itemId = bundle?._id;
    if (!itemId) return;
    const itemType = kind === 'panels' ? 'TestPanel' : 'TestPackage';
    setSelectedItems((prev) => {
      if (prev.some((item) => item.itemId === itemId && item.itemType === itemType)) return prev;
      const members = Array.isArray(bundle.includedTests)
        ? bundle.includedTests
        : Array.isArray(bundle.tests)
          ? bundle.tests
          : [];
      const memberNames = members
        .map((member) => (typeof member === 'string' ? member : member?.name || member?.code || ''))
        .filter(Boolean);
      return [...prev, {
        itemId,
        itemType,
        name: `${bundle.name} (bundle)`,
        price: Number(bundle.price) || 0,
        comboName: bundle.name,
        comboId: itemId,
        comboMembers: memberNames
      }];
    });
    requestAnimationFrame(revealCart);
  };

  const selectedBundleIds = selectedItems
    .filter((item) => item.itemType === 'TestPackage' || item.itemType === 'TestPanel')
    .map((item) => item.itemId);

  const subtotal = selectedItems.reduce((s, item) => s + Number(item.price || 0), 0);
  // Discount supports two modes toggled by the %/₹ badge: percent (0–100%)
  // or flat amount (₹, clamped to subtotal).
  const discountPercentNum = discountPercent === '' || discountPercent === null ? 0 : Number(discountPercent);
  const discountValueNum = discountValue === '' || discountValue === null ? 0 : Number(discountValue);
  const discountAmount = discountMode === 'amount'
    ? Math.max(0, Math.min(subtotal, discountValueNum || 0))
    : Math.max(0, Math.min(subtotal, (subtotal * (discountPercentNum || 0)) / 100));
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  // Prefill patient + items from a confirmed booking inquiry. Catalog-aware:
  // refIds are used directly; otherwise names are matched against the loaded
  // tests/packages/panels so every prefilled line carries a real catalog ID
  // (BillItem.itemId is a required ObjectId). Unmatched names are reported
  // so staff can pick them manually instead of failing at submit.
  useEffect(() => {
    if (!bookingPrefill) return;
    const b = bookingPrefill;
    if (b.patientId) {
      setPatientForm((prev) => ({
        ...prev,
        isExistingPatient: true,
        selectedPatientId: b.patientId,
        patientPhone: b.phone || prev.patientPhone
      }));
      // The linked profile may sit outside the preloaded first-100 list —
      // fetch it so the picker displays the name immediately.
      if (!patients.some((p) => String(p._id) === String(b.patientId))) {
        getPatientById(b.patientId)
          // GET /patients/:id returns { patient, bills, reports, transactions }
          .then((res) => { const p = res?.data?.patient || res?.data; if (res?.success && p?._id) setPickedPatient(p); })
          .catch(() => { /* picker stays searchable — non-fatal */ });
      }
    } else {
      const parts = String(b.name || '').trim().split(/\s+/);
      setPatientForm((prev) => ({
        ...prev,
        isExistingPatient: false,
        patientFirstName: parts[0] || '',
        patientLastName: parts.slice(1).join(' ') || '',
        patientPhone: b.phone || ''
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bookingPrefill?.items?.length) return;
    if (!tests.length && !packages.length && !panels.length) return;
    const norm = (s) => String(s || '').trim().toLowerCase();
    const findById = (id, list) => (list || []).find((t) => String(t._id) === String(id));
    const findByName = (name, list) => (list || []).find((t) => norm(t.name) === norm(name));
    const resolved = [];
    const unmatched = [];
    for (const it of bookingPrefill.items) {
      const kind = it.kind;
      let match = null;
      let itemType = 'Test';
      if (kind === 'Test') {
        match = (it.refId && findById(it.refId, tests)) || findByName(it.name, tests);
        itemType = 'Test';
      } else if (kind === 'Package') {
        match = (it.refId && findById(it.refId, packages)) || findByName(it.name, packages);
        itemType = 'TestPackage';
      } else {
        match = (it.refId && findById(it.refId, tests))
          || findByName(it.name, tests)
          || findByName(it.name, packages)
          || findByName(it.name, panels);
        itemType = match && panels.includes(match) ? 'TestPanel'
          : match && packages.includes(match) ? 'TestPackage' : 'Test';
      }
      if (match) {
        resolved.push({ itemId: match._id, itemType, name: match.name, price: Number(match.price) || 0 });
      } else if (it.refId && /^[a-fA-F0-9]{24}$/.test(String(it.refId))) {
        // Valid ObjectId but not in the loaded catalog slice — keep it; the
        // server stores the line with the inquiry's name/price.
        resolved.push({
          itemId: it.refId,
          itemType: kind === 'Package' ? 'TestPackage' : 'Test',
          name: it.name, price: Number(it.price) || 0
        });
      } else {
        unmatched.push(it.name);
      }
    }
    if (resolved.length) {
      setSelectedItems((prev) => {
        if (prev.length) return prev; // don't clobber user picks on re-renders
        // Handoff consumed — later manual visits start empty.
        clearBookingPrefill();
        return resolved;
      });
      setBookingBanner(
        `Prefilled from confirmed booking${bookingPrefill.name ? ` — ${bookingPrefill.name}` : ''} (${resolved.length} item${resolved.length === 1 ? '' : 's'}). Verify before invoicing.`
      );
    }
    if (unmatched.length) setUnmatchedBookingItems(unmatched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tests, packages, panels]);

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
    if (discountMode === 'percent') {
      if (discountPercent !== '' && (discountPercentNum < 0 || discountPercentNum > 100)) {
        errs.discount = 'Discount must be between 0 and 100%.';
      }
    } else if (discountValue !== '' && discountValueNum < 0) {
      errs.discount = 'Discount amount cannot be negative.';
    }
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
        discountPercent: discountMode === 'percent' && discountPercentNum > 0
      });

      if (res.success) {
        clearBookingPrefill();
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
  // Never dead-end billing: departments with no dedicated tests (e.g.
  // OUTSOURCE LAB) fall back to the full active catalog with a notice.
  const deptFallback = activeDepartment !== 'LAB' && departmentTests.length === 0;
  const deptTestList = deptFallback
    ? tests.filter((t) => !t.status || t.status === 'Active')
    : departmentTests;

  // Picker source per active tab — every price comes from the existing
  // catalog APIs (tests / packages / panels); nothing is priced in frontend
  // constants, and all three types are accepted by the bill validator.
  const pickerSource =
    pickerType === 'TestPackage' ? packages : pickerType === 'TestPanel' ? panels : deptTestList;
  const pickerItems = (Array.isArray(pickerSource) ? pickerSource : [])
    .filter((item) => !item.status || item.status === 'Active');
  // Local filter first; server results used only when local has no matches.
  const pickerQ = pickerQuery.trim();
  const localFiltered = pickerQ
    ? pickerItems.filter((item) => matchesPickerQuery(item, pickerQ))
    : pickerItems;
  const usingServerResults =
    pickerType === 'Test' && pickerQ.length > 0 && localFiltered.length === 0;
  const filteredPickerItems = usingServerResults ? serverResults : localFiltered;

  useEffect(() => {
    if (!usingServerResults) {
      setServerResults([]);
      setServerSearching(false);
      return undefined;
    }
    let cancelled = false;
    setServerSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await getTests({ search: pickerQ, status: 'Active' });
        if (cancelled) return;
        setServerResults(res?.success && Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setServerResults([]);
      } finally {
        if (!cancelled) setServerSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [usingServerResults, pickerQ]);

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const pickerEmptyText = serverSearching
    ? 'Searching catalog…'
    : pickerQ
      ? `No matches for “${pickerQ}”.`
      : pickerType === 'Test'
        ? (deptFallback
            ? 'No tests found.'
            : `No tests mapped under ${activeDepartment}`)
        : pickerType === 'TestPackage'
          ? 'No packages available.'
          : 'No panels available.';

  const handlePickerSelect = (item) => {
    if (pickerType === 'Test') {
      handleAddItem(item, 'Test');
      return;
    }
    handleSelectBundle(item, pickerType === 'TestPanel' ? 'panels' : 'packages');
  };

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

      {bookingBanner && (
        <div
          role="status"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-success-bg, #ecfdf5)',
            color: 'var(--color-success, #166534)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-sm)'
          }}
        >
          {bookingBanner}
        </div>
      )}
      {unmatchedBookingItems.length > 0 && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-warning-bg, #fef9c3)',
            color: 'inherit',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-sm)'
          }}
        >
          Could not auto-match from the booking: {unmatchedBookingItems.join(', ')}. Please add them manually from the picker.
        </div>
      )}

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
            <DepartmentSelector activeDepartment={activeDepartment} onSelect={(d) => { setActiveDepartment(d); setPickerQuery(''); }} />

            {/* Single search: local catalog first, server fallback for tests */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                Select services
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <Button variant={pickerType === 'Test' ? 'primary' : 'secondary'} size="sm" onClick={() => { setPickerType('Test'); setPickerQuery(''); }}>
                  Tests
                </Button>
                <Button variant={pickerType === 'TestPackage' ? 'primary' : 'secondary'} size="sm" onClick={() => { setPickerType('TestPackage'); setPickerQuery(''); }}>
                  Packages
                </Button>
                <Button variant={pickerType === 'TestPanel' ? 'primary' : 'secondary'} size="sm" onClick={() => { setPickerType('TestPanel'); setPickerQuery(''); }}>
                  Panels
                </Button>
              </div>
              <div className="test-picker-search" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input
                  type="search"
                  className="form-control"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={`Search ${pickerType === 'Test' ? 'tests' : pickerType === 'TestPackage' ? 'packages' : 'panels'} by name or code…`}
                  aria-label={`Search ${pickerType} list`}
                  style={{ flex: 1 }}
                />
                {pickerQuery && (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {serverSearching
                      ? 'Searching…'
                      : `${filteredPickerItems.length} match${filteredPickerItems.length === 1 ? '' : 'es'}${usingServerResults ? ' (server)' : ''}`}
                  </span>
                )}
              </div>
              {deptFallback && pickerType === 'Test' && !pickerQ && (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-2)' }}>
                  No dedicated {activeDepartment} tests — showing full catalog.
                </p>
              )}
              <div className="test-picker-list">
                {filteredPickerItems.length === 0 ? (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-5)' }}>
                    {pickerEmptyText}
                  </p>
                ) : (
                  filteredPickerItems.map((item) => {
                    const alreadyAdded = pickerType === 'Test'
                      ? selectedItems.some((si) => si.itemId === item._id && si.itemType === 'Test')
                      : selectedBundleIds.includes(item._id);
                    return (
                      <div
                        key={item._id}
                        className="test-picker-item"
                        onClick={() => !alreadyAdded && handlePickerSelect(item)}
                        role="button"
                        tabIndex={alreadyAdded ? -1 : 0}
                        aria-disabled={alreadyAdded}
                        onKeyDown={(e) => { if (!alreadyAdded && e.key === 'Enter') handlePickerSelect(item); }}
                      >
                        <span>
                          {item.name}
                          {item.code ? ` (${item.code})` : ''}
                          {alreadyAdded ? ' — Added' : ''}
                        </span>
                        <strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(item.price)}</strong>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right column — sticky cart on desktop */}
        <div
          ref={cartRef}
          id="bill-cart"
          className="bill-summary-column"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
        >
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
            discountMode={discountMode}
            setDiscountMode={setDiscountMode}
            discountPercent={discountPercent}
            setDiscountPercent={setDiscountPercent}
            discountValue={discountValue}
            setDiscountValue={setDiscountValue}
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

      {selectedItems.length > 0 && (
        <button
          type="button"
          className="bill-cart-dock"
          onClick={revealCart}
          aria-label="View selected items in cart"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={16} />
            {selectedItems.length} item{selectedItems.length === 1 ? '' : 's'} in cart
          </span>
          <strong>{formatCurrency(totalAmount)}</strong>
        </button>
      )}
    </div>
  );
};

export default BillCreateForm;
