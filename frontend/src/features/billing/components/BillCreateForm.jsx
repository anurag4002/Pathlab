import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createBill, updateBill, getBills, getBillById } from '../../../services/billService';
import { rovingKeyDown } from '../../../utils/rovingFocus';
import { useUiVersion, isNewUi } from '../../../utils/uiVersion';
import PageTip from '../../../components/common/PageTip';
import { notify } from '../../../components/common/Toast/toast';

const PICKER_TABS = [
  { key: 'All', label: 'All' },
  { key: 'Test', label: 'Tests' },
  { key: 'TestPackage', label: 'Packages' },
  { key: 'TestPanel', label: 'Panels' }
];
import { createPatient, getPatientById, updatePatient } from '../../../services/patientService';
import { getTests } from '../../../services/testService';
import { getUSGServices } from '../../../services/usgService';
import { PageHeader, Button, Select, Input } from '../../../components/common';
import useAuth from '../../../hooks/useAuth';
import PatientDetailsSection from './PatientDetailsSection';
import DepartmentSelector from './DepartmentSelector';
import BillItemsTable from './BillItemsTable';
import PaymentSummarySection from './PaymentSummarySection';
import ComboIndicator from './ComboIndicator';
import OutsourceTestModal from './OutsourceTestModal';
import QuickAddContact from './QuickAddContact';
import SearchSelect from '../../../components/common/SearchSelect/SearchSelect';
import { createDoctor } from '../../../services/doctorService';
import { createAgent } from '../../../services/agentService';
import { filterTestsByDepartment, DEPT_TO_CASE_TYPE } from '../billingConstants';
import { ArrowLeft, Plus, ShoppingCart, ExternalLink } from 'lucide-react';
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

// Module-scope booking handoff — survives StrictMode remounts. Always prefer
// a fresh sessionStorage write (Confirm & Bill) over a stale empty cache from
// an earlier /bills/new visit.
let cachedBookingPrefill = null;
const takeBookingPrefill = (fallback) => {
  try {
    const raw = sessionStorage.getItem('billBookingPrefill');
    if (raw) {
      cachedBookingPrefill = JSON.parse(raw);
      return cachedBookingPrefill;
    }
  } catch {
    /* storage unavailable — ignore */
  }
  if (cachedBookingPrefill) return cachedBookingPrefill;
  if (fallback) {
    cachedBookingPrefill = fallback;
    return cachedBookingPrefill;
  }
  return null;
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
  // Email / Address / Aadhaar / History are always on by default in billing
  showEmail: true,
  showAddress: true,
  showAadhaar: true,
  showHistory: true,
  patientEmail: '',
  patientAddress: '',
  patientAadhaar: '',
  patientHistory: ''
};

/** Build "Register New" patient fields from a booking inquiry (no linked patient). */
// New look: a half-typed new patient survives a closed panel, a reload or a
// trip to another screen in this tab (cleared once the bill is created).
const PATIENT_DRAFT_KEY = 'ppl_bill_new_patient_draft';
const readPatientDraft = () => {
  if (!isNewUi()) return null;
  try { const draft = JSON.parse(sessionStorage.getItem(PATIENT_DRAFT_KEY) || 'null'); return draft && !draft.isExistingPatient ? { ...EMPTY_PATIENT_FORM, ...draft } : null; } catch { return null; }
};
const clearPatientDraft = () => { try { sessionStorage.removeItem(PATIENT_DRAFT_KEY); } catch { /* ignore */ } };
// New look: the whole half-made bill (tests, doctor, agent, department,
// discount, amount received, payment mode, chosen patient) survives a reload
// in this tab. Not used in edit mode or when opened from a booking.
const BILL_DRAFT_KEY = 'ppl_bill_draft';
const readBillDraft = () => {
  if (!isNewUi()) return null;
  try { return JSON.parse(sessionStorage.getItem(BILL_DRAFT_KEY) || 'null'); } catch { return null; }
};
const clearBillDraft = () => { try { sessionStorage.removeItem(BILL_DRAFT_KEY); } catch { /* ignore */ } };

const bookingToNewPatientForm = (b, prev = EMPTY_PATIENT_FORM) => {
  const rawName = String(b?.name || '').trim();
  const parts = rawName.split(/\s+/).filter(Boolean);
  const titles = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Mr', 'Mrs', 'Ms', 'Dr'];
  const hasTitle = parts.length && titles.includes(parts[0]);
  const title = hasTitle
    ? (parts[0].endsWith('.') ? parts[0] : `${parts[0]}.`)
    : (b?.title || prev.patientTitle || 'Mr.');
  const nameParts = hasTitle ? parts.slice(1) : parts;
  return {
    ...prev,
    isExistingPatient: false,
    selectedPatientId: '',
    showEmail: true,
    showAddress: true,
    showAadhaar: true,
    showHistory: true,
    patientTitle: ['Mr.', 'Mrs.', 'Ms.', 'Dr.'].includes(title) ? title : 'Mr.',
    patientFirstName: nameParts[0] || '',
    patientLastName: nameParts.slice(1).join(' ') || '',
    patientPhone: b?.phone || '',
    patientEmail: b?.email || '',
    patientAddress: b?.address || '',
    patientAadhaar: b?.aadhaar || '',
    patientHistory: b?.history || b?.note || '',
    patientGender: b?.gender || prev.patientGender || 'Male',
    patientAgeYears: b?.age != null && b?.age !== '' ? String(b.age) : prev.patientAgeYears
  };
};

/** Map a Patient document into billing patient-form fields (invoice / booking / picker). */
const applyPatientToForm = (pat, prev = EMPTY_PATIENT_FORM) => {
  if (!pat) return prev;
  const nameParts = String(pat.name || '').trim().split(/\s+/);
  const titleGuess = ['Mr.', 'Mrs.', 'Ms.', 'Dr.'].includes(nameParts[0]) ? nameParts[0] : (pat.title || prev.patientTitle);
  const first = pat.title || ['Mr.', 'Mrs.', 'Ms.', 'Dr.'].includes(nameParts[0])
    ? nameParts[1] || ''
    : nameParts[0] || '';
  const last = pat.title || ['Mr.', 'Mrs.', 'Ms.', 'Dr.'].includes(nameParts[0])
    ? nameParts.slice(2).join(' ')
    : nameParts.slice(1).join(' ');
  return {
    ...prev,
    selectedPatientId: pat._id || prev.selectedPatientId,
    patientTitle: titleGuess || 'Mr.',
    patientPhone: pat.phone || prev.patientPhone,
    patientFirstName: first || prev.patientFirstName,
    patientLastName: last || prev.patientLastName,
    patientGender: pat.gender || prev.patientGender || 'Male',
    patientAgeYears: pat.age != null && pat.age !== '' ? String(pat.age) : prev.patientAgeYears,
    patientEmail: pat.email || '',
    patientAddress: pat.address || '',
    patientAadhaar: pat.aadhaar || '',
    patientHistory: pat.history || '',
    showEmail: true,
    showAddress: true,
    showAadhaar: true,
    showHistory: true
  };
};

const BillCreateForm = ({
  patients = [],
  doctors = [],
  agents = [],
  tests = [],
  packages = [],
  panels = [],
  onBillCreated,
  // Edit mode: reuse this same form to edit an existing bill. The parent
  // fetches the full bill first and mounts with key={bill._id}, so lazy
  // initialisers below can safely read editBill on first render.
  editBill = null,
  branches = [],
  onBillUpdated = null,
  onCancelEdit = null
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = !!editBill;
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const editPatient = editBill?.patient && typeof editBill.patient === 'object' ? editBill.patient : null;
  const editPatientId = editPatient?._id || (typeof editBill?.patient === 'string' ? editBill.patient : '');
  const [identity, setIdentity] = useState(() => ({ name: editPatient?.name || '', phone: editPatient?.phone || '' }));
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityMessage, setIdentityMessage] = useState(null);
  const saveIdentity = async () => {
    setIdentityBusy(true); setIdentityMessage(null);
    try {
      await updatePatient(editPatientId, { name: identity.name.trim(), phone: identity.phone.trim() });
      setIdentityMessage({ error: false, text: 'Patient details saved. Linked bills and reports use these details.' });
    } catch (error) { setIdentityMessage({ error: true, text: getApiErrorMessage(error, 'Could not update patient details.') }); }
    finally { setIdentityBusy(false); }
  };
  const idOf = (ref) => (ref && ref._id ? String(ref._id) : (ref ? String(ref) : ''));
  // Prefill from a confirmed booking inquiry (Inquiries → "Confirm & Bill").
  // Handoff arrives via sessionStorage (survives URL-mirroring replaces and
  // refreshes); router state is accepted as a fallback. Read via the module
  // cache so React StrictMode's dev double-mount sees the same value on both
  // passes; cleared once the items are applied (see items effect below).
  // Skipped entirely in edit mode (a bill is already loaded).
  const [bookingPrefill] = useState(() => (editBill ? null : takeBookingPrefill(location.state?.booking || null)));
  const [billDraft] = useState(() => (editBill || bookingPrefill ? null : readBillDraft()));
  // Decided once on open: was anything brought back from before a reload?
  const [restoredDraft] = useState(() => !editBill && !bookingPrefill && !!(readBillDraft() || readPatientDraft()));

  // Prefill Register New immediately so unregistered inquiry details show even
  // if a later effect is skipped (StrictMode / navigation timing).
  const [patientForm, setPatientForm] = useState(() => {
    if (editBill) {
      return {
        ...applyPatientToForm(editPatient || {}, EMPTY_PATIENT_FORM),
        isExistingPatient: true,
        selectedPatientId: editPatientId
      };
    }
    const b = takeBookingPrefill(null);
    if (!b) {
      // A chosen (registered) patient from the saved half-made bill.
      if (billDraft?.patientForm?.isExistingPatient && billDraft.patientForm.selectedPatientId) return { ...EMPTY_PATIENT_FORM, ...billDraft.patientForm };
      return readPatientDraft() || EMPTY_PATIENT_FORM;
    }
    const linkedId = b.patientId && String(b.patientId) !== 'null' ? b.patientId : null;
    if (linkedId) {
      return {
        ...applyPatientToForm({
          _id: linkedId,
          name: b.name,
          phone: b.phone,
          email: b.email,
          address: b.address,
          aadhaar: b.aadhaar,
          history: b.history || b.note,
          age: b.age,
          gender: b.gender,
          title: b.title
        }, EMPTY_PATIENT_FORM),
        isExistingPatient: true,
        selectedPatientId: linkedId
      };
    }
    return bookingToNewPatientForm(b);
  });
  const isV2 = useUiVersion() === 'v2';
  useEffect(() => {
    if (!isV2 || isEditMode) return;
    try {
      const typed = !patientForm.isExistingPatient && (patientForm.patientPhone || patientForm.patientFirstName || patientForm.patientLastName || patientForm.patientAgeYears);
      if (typed) sessionStorage.setItem(PATIENT_DRAFT_KEY, JSON.stringify(patientForm));
      else sessionStorage.removeItem(PATIENT_DRAFT_KEY);
    } catch { /* ignore */ }
  }, [patientForm, isV2, isEditMode]);
  const [bookingBanner, setBookingBanner] = useState('');
  const [unmatchedBookingItems, setUnmatchedBookingItems] = useState([]);
  const [outsourceOpen, setOutsourceOpen] = useState(false);
  // Full picked patient object (may come from server search beyond the
  // preloaded first-100 list, so it can't be re-derived from `patients`).
  const [pickedPatient, setPickedPatient] = useState(() => editPatient || billDraft?.pickedPatient || null);
  const [selectedDoctor, setSelectedDoctor] = useState(() => (editBill ? idOf(editBill.referringDoctor) : billDraft?.doctor || idOf(undefined)));
  const [selectedAgent, setSelectedAgent] = useState(() => (editBill ? idOf(editBill.agent) : billDraft?.agent || idOf(undefined)));
  const [activeDepartment, setActiveDepartment] = useState(() => editBill?.department || billDraft?.department || 'ALL');
  const [usgServices, setUSGServices] = useState([]);
  const [usgError, setUSGError] = useState('');
  const [usgRetry, setUSGRetry] = useState(0);
  useEffect(() => {
    if (activeDepartment !== 'USG') return undefined;
    let active = true;
    setUSGError('');
    getUSGServices().then(response => {
      if (active) setUSGServices(response.data || []);
    }).catch(error => { if (active) setUSGError(getApiErrorMessage(error, 'Could not load USG services.')); });
    return () => { active = false; };
  }, [activeDepartment, usgRetry]);
  // Bill-edit extras: collection centre dropdown + Paid/locked override.
  const [editCollectionCentre, setEditCollectionCentre] = useState(() => editBill?.collectionCentre || 'Main');
  const [editAdminOverride, setEditAdminOverride] = useState(false);
  // 'All' | 'Test' | 'TestPackage' | 'TestPanel'
  const [pickerType, setPickerType] = useState('All');
  // One search box: filter local catalog first, then fall back to server (tests).
  // New look: plain three-step form; rarely used options folded away.
  const [moreOpen, setMoreOpen] = useState(false);
  // New look: doctors/agents added from this page (no trip to another screen).
  const [addedDoctors, setAddedDoctors] = useState([]);
  const [addedAgents, setAddedAgents] = useState([]);
  const [quickAdd, setQuickAdd] = useState(null); // 'doctor' | 'agent' | null
  const [pickerQuery, setPickerQuery] = useState('');
  // Keyboard picking: Up/Down move the highlight, Enter adds it and clears
  // the search so the next test can be typed straight away.
  const [pickerHighlight, setPickerHighlight] = useState(0);
  const pickerInputRef = useRef(null);
  const [pickerFocused, setPickerFocused] = useState(false);
  const [serverResults, setServerResults] = useState([]);
  const [serverSearching, setServerSearching] = useState(false);
  const [selectedItems, setSelectedItems] = useState(() => (
    editBill && Array.isArray(editBill.items)
      ? editBill.items.map((it, i) => ({
        itemId: it.itemId && it.itemId._id ? String(it.itemId._id) : (it.itemId ? String(it.itemId) : null),
        itemType: it.itemType || 'Custom',
        name: it.name || '',
        price: Number(it.price || 0),
        _key: String(it._id || it.id || `bill-item-${i}`)
      }))
      : (Array.isArray(billDraft?.items) ? billDraft.items : [])
  ));
  const [discountPercent, setDiscountPercent] = useState(() => billDraft?.discountPercent ?? '');
  const [discountValue, setDiscountValue] = useState(() => (editBill?.discount != null ? String(editBill.discount) : billDraft?.discountValue ?? ''));
  // Edit mode starts on flat-₹ discount (the bill stores a flat amount) and
  // locks the already-collected amount (Pay/Refund flows own it).
  const [discountMode, setDiscountMode] = useState(() => (editBill ? 'amount' : billDraft?.discountMode || 'percent'));
  const [paidAmount, setPaidAmount] = useState(() => (editBill ? Number(editBill.paidAmount || 0) : Number(billDraft?.paidAmount || 0)));
  const [paymentMethod, setPaymentMethod] = useState(() => editBill?.paymentMethod || billDraft?.paymentMethod || 'Cash');
  // Save the half-made bill as it is typed (new look, new bills only).
  useEffect(() => {
    if (!isV2 || isEditMode) return;
    const existing = patientForm.isExistingPatient && patientForm.selectedPatientId;
    const started = selectedItems.length || selectedDoctor || selectedAgent || (activeDepartment && activeDepartment !== 'ALL')
      || discountPercent || discountValue || Number(paidAmount) || existing;
    try {
      if (!started) { sessionStorage.removeItem(BILL_DRAFT_KEY); return; }
      sessionStorage.setItem(BILL_DRAFT_KEY, JSON.stringify({
        items: selectedItems, doctor: selectedDoctor, agent: selectedAgent, department: activeDepartment,
        discountMode, discountPercent, discountValue, paidAmount, paymentMethod,
        patientForm: existing ? patientForm : null, pickedPatient: existing ? pickedPatient : null,
      }));
    } catch { /* storage full or blocked */ }
  }, [isV2, isEditMode, selectedItems, selectedDoctor, selectedAgent, activeDepartment, discountMode, discountPercent, discountValue, paidAmount, paymentMethod, patientForm, pickedPatient]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const cartRef = useRef(null);
  const flashTimerRef = useRef(null);
  const bookingItemsAppliedRef = useRef(false);

  const handlePatientSelect = (pat) => {
    if (!pat) {
      setPickedPatient(null);
      setPatientForm((prev) => ({ ...prev, selectedPatientId: '' }));
      return;
    }
    setPickedPatient(pat);
    setPatientForm((prev) => applyPatientToForm(pat, prev));
    // List picker rows can be slim — pull full profile so Email/Address/Aadhaar/History fill in.
    getPatientById(pat._id)
      .then((res) => {
        const full = res?.data?.patient || res?.data;
        if (res?.success && full?._id) {
          setPickedPatient(full);
          setPatientForm((prev) => applyPatientToForm(full, prev));
        }
      })
      .catch(() => { /* keep slim picker data */ });
  };

  const revealCart = () => {
    const el = cartRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.classList.add('bill-cart-flash');
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => el.classList.remove('bill-cart-flash'), 700);
  };

  // New look: the bill screen is locked to the window - measure where the
  // boxes start so they fill exactly the space left (no page scroll).
  const gridRef = useRef(null);
  useEffect(() => {
    if (!isV2) return undefined;
    const fit = () => {
      const el = gridRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.setProperty('--bill-grid-top', `${Math.round(top)}px`);
      // Everything below the boxes (page padding) counts too.
      let below = 0;
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        below += (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
      }
      el.style.setProperty('--bill-grid-below', `${Math.ceil(below) + 2}px`);
    };
    fit();
    const frame = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', fit); };
  }, [isV2, bookingBanner, unmatchedBookingItems.length, errors.api]);
  // ...and when a test is added, the bill list scrolls to show it.
  const lastCount = useRef(0);
  useEffect(() => {
    const count = selectedItems.length;
    if (isV2 && count > lastCount.current) {
      requestAnimationFrame(() => {
        const box = document.querySelector('.bill-step-cart');
        if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
      });
    }
    lastCount.current = count;
  }, [selectedItems.length, isV2]);

  const handleAddItem = (item, type) => {
    const alreadyAdded = selectedItems.some(
      (si) => si.itemId === item._id && si.itemType === type
    );
    if (alreadyAdded) return;
    setSelectedItems((prev) => [...prev, { itemId: item._id, itemType: type, name: item.name, price: item.price }]);
    requestAnimationFrame(revealCart);
  };

  const handleAddOutsourceTest = ({ name, price }) => {
    const key = `custom-${name.trim().toLowerCase()}-${price}`;
    setSelectedItems((prev) => {
      if (prev.some((si) => si.itemType === 'Custom' && si._key === key)) return prev;
      return [...prev, {
        itemId: null,
        itemType: 'Custom',
        name: name.trim(),
        price: Number(price) || 0,
        _key: key
      }];
    });
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

  // Prefill patient + items from a confirmed booking inquiry.
  // Unregistered bookings open "Register New" with name/phone/note filled.
  useEffect(() => {
    if (!bookingPrefill) return;
    const b = bookingPrefill;
    const linkedId = b.patientId && String(b.patientId) !== 'null' ? b.patientId : null;

    if (linkedId) {
      // Optimistic fill from inquiry; swap to full profile when fetch succeeds.
      setPatientForm((prev) => ({
        ...applyPatientToForm({
          _id: linkedId,
          name: b.name,
          phone: b.phone,
          email: b.email,
          address: b.address,
          aadhaar: b.aadhaar,
          history: b.history || b.note,
          age: b.age,
          gender: b.gender,
          title: b.title
        }, prev),
        isExistingPatient: true,
        selectedPatientId: linkedId
      }));
      getPatientById(linkedId)
        .then((res) => {
          const p = res?.data?.patient || res?.data;
          if (res?.success && p?._id) {
            setPickedPatient(p);
            setPatientForm((prev) => applyPatientToForm(p, { ...prev, isExistingPatient: true }));
            return;
          }
          // Linked id missing / not registered — fall back to new patient from booking.
          setPickedPatient(null);
          setPatientForm((prev) => bookingToNewPatientForm(b, prev));
        })
        .catch(() => {
          setPickedPatient(null);
          setPatientForm((prev) => bookingToNewPatientForm(b, prev));
        });
    } else {
      setPickedPatient(null);
      setPatientForm((prev) => bookingToNewPatientForm(b, prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bookingPrefill?.items?.length || bookingItemsAppliedRef.current) return;
    // Wait for catalog load when booking lines may match tests/packages/panels.
    const needsCatalog = bookingPrefill.items.some(
      (it) => it.refId || it.kind === 'Test' || it.kind === 'Package'
    );
    if (needsCatalog && !tests.length && !packages.length && !panels.length) return;

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
        resolved.push({
          itemId: match._id,
          itemType,
          name: match.name,
          price: Number(match.price) || Number(it.price) || 0
        });
      } else if (it.refId && /^[a-fA-F0-9]{24}$/.test(String(it.refId))) {
        resolved.push({
          itemId: it.refId,
          itemType: kind === 'Package' ? 'TestPackage' : 'Test',
          name: it.name,
          price: Number(it.price) || 0
        });
      } else {
        // Every booking line stays selected — Custom name + rate from inquiry.
        resolved.push({
          itemId: null,
          itemType: 'Custom',
          name: it.name,
          price: Number(it.price) || 0,
          _key: `booking-${norm(it.name)}-${it.price}`
        });
        unmatched.push(it.name);
      }
    }
    if (!resolved.length) return;
    bookingItemsAppliedRef.current = true;
    setSelectedItems(resolved);
    setUnmatchedBookingItems(unmatched);
    // Drop session key only — keep module cache so StrictMode remount still prefills.
    try {
      sessionStorage.removeItem('billBookingPrefill');
    } catch {
      /* ignore */
    }
    setBookingBanner(
      `Prefilled from confirmed booking${bookingPrefill.name ? ` — ${bookingPrefill.name}` : ''} (${resolved.length} item${resolved.length === 1 ? '' : 's'} selected). Verify before invoicing.`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tests, packages, panels]);

  const validate = () => {
    const errs = {};
    if (isEditMode) {
      // Patient is locked to the original invoice in edit mode.
      if (selectedItems.length === 0) errs.items = 'Please select at least one test or package';
      if (discountAmount > subtotal) errs.discount = 'Discount cannot exceed the subtotal.';
      if (totalAmount < Number(editBill.paidAmount || 0)) {
        errs.discount = 'New total is less than the amount already paid. Issue a refund instead.';
      }
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }
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
    // Say what is missing and bring it into view: errors further up the form
    // were invisible when Create Invoice / Alt+Enter was pressed at the bottom.
    if (Object.keys(errs).length) {
      notify(Object.values(errs)[0]);
      requestAnimationFrame(() => {
        const target = document.querySelector('.form-error, [aria-invalid="true"]');
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const field = target?.matches?.('input, select, textarea') ? target : target?.closest('.form-group')?.querySelector('input, select, textarea');
        field?.focus({ preventScroll: true });
      });
    }
    return Object.keys(errs).length === 0;
  };

  // Ctrl+B ("Bill") creates / updates the invoice from anywhere on the form.
  // Matched on the physical key (event.code), so it works with any keyboard
  // layout or input tool; neither Windows nor Chrome uses Ctrl+B. Ctrl+Enter
  // and Alt+Enter still work where the keyboard lets them through.
  const submitRef = useRef(null);
  useEffect(() => {
    const onKey = (event) => {
      const ctrl = event.ctrlKey || event.metaKey;
      const billKey = ctrl && !event.shiftKey && !event.altKey && (event.code === 'KeyB' || String(event.key).toLowerCase() === 'b');
      const enterKey = event.key === 'Enter' && (ctrl || event.altKey);
      if (!billKey && !enterKey) return;
      if (event.repeat || document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      event.stopPropagation();
      submitRef.current?.({ fromShortcut: true });
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  const handleSubmit = async ({ fromShortcut = false } = {}) => {
    if (submitting) return;
    if (!validate()) return;
    if (fromShortcut) notify(isEditMode ? 'Saving the bill…' : 'Creating invoice…');
    setSubmitting(true);
    try {
      if (isEditMode) {
        // Same bill, new lines — the server re-totals, re-syncs lab report
        // shells/queue, and blocks lines that already have results recorded.
        const billItems = selectedItems.map(({ itemId, itemType, name, price }) => {
          const row = { itemType, name, price: Number(price) || 0 };
          if (itemType !== 'Custom' && itemId) row.itemId = itemId;
          return row;
        });
        const res = await updateBill(editBill._id, {
          items: billItems,
          discount: discountAmount,
          paymentMethod,
          collectionCentre: editCollectionCentre,
          caseType: DEPT_TO_CASE_TYPE[activeDepartment] || editBill.caseType,
          referringDoctor: selectedDoctor || null,
          agent: selectedAgent || null,
          ...(editAdminOverride ? { adminOverride: true } : {})
        });
        if (res.success) {
          onBillUpdated?.(res.data);
          navigate('/cases/bills');
        }
        return;
      }
      let patientId = patientForm.selectedPatientId;
      const profilePayload = {
        title: patientForm.patientTitle || '',
        phone: patientForm.patientPhone,
        gender: patientForm.patientGender,
        age: Number(patientForm.patientAgeYears) || undefined,
        address: patientForm.showAddress ? (patientForm.patientAddress || '') : undefined,
        email: patientForm.showEmail ? (patientForm.patientEmail || '') : undefined,
        aadhaar: patientForm.showAadhaar ? (patientForm.patientAadhaar || '') : undefined,
        history: patientForm.showHistory ? (patientForm.patientHistory || '') : undefined
      };

      if (!patientForm.isExistingPatient) {
        const patientPayload = {
          ...profilePayload,
          name: `${patientForm.patientTitle} ${patientForm.patientFirstName} ${patientForm.patientLastName}`.trim(),
          age: Number(patientForm.patientAgeYears),
          address: patientForm.showAddress ? patientForm.patientAddress : '',
          email: patientForm.showEmail ? patientForm.patientEmail : '',
          aadhaar: patientForm.showAadhaar ? patientForm.patientAadhaar : '',
          history: patientForm.showHistory ? patientForm.patientHistory : ''
        };
        const patRes = await createPatient(patientPayload);
        if (!patRes.success) throw new Error('Failed to auto-register patient');
        patientId = patRes.data._id;
      } else if (patientId) {
        // Keep invoice ↔ profile in sync for Email / Address / Aadhaar / History
        try {
          await updatePatient(patientId, {
            phone: profilePayload.phone,
            gender: profilePayload.gender,
            ...(profilePayload.age != null ? { age: profilePayload.age } : {}),
            ...(patientForm.showAddress ? { address: patientForm.patientAddress || '' } : {}),
            ...(patientForm.showEmail ? { email: patientForm.patientEmail || '' } : {}),
            ...(patientForm.showAadhaar ? { aadhaar: patientForm.patientAadhaar || '' } : {}),
            ...(patientForm.showHistory ? { history: patientForm.patientHistory || '' } : {})
          });
        } catch {
          /* non-fatal — bill still proceeds */
        }
      }

      // Courtesy guard: 200 bills/day soft limit (§10)
      // Custom/outsource lines omit itemId (name + rate only).
      const billItems = selectedItems.map(({ itemId, itemType, name, price }) => {
        const row = { itemType, name, price: Number(price) || 0 };
        if (itemType !== 'Custom' && itemId) row.itemId = itemId;
        return row;
      });
      // Only send-out tests (and no department picked): file it as an outsource case.
      const onlyOutsourceLines = activeDepartment === 'ALL' && selectedItems.length > 0 && selectedItems.every((si) => si.itemType === 'Custom');
      const res = await createBill({
        patient: patientId,
        referringDoctor: selectedDoctor || null,
        agent: selectedAgent || null,
        items: billItems,
        discount: discountAmount,
        paidAmount,
        paymentMethod,
        department: onlyOutsourceLines ? 'OUTSOURCE LAB' : activeDepartment === 'ALL' ? 'LAB' : activeDepartment,
        caseType: onlyOutsourceLines ? DEPT_TO_CASE_TYPE['OUTSOURCE LAB'] : DEPT_TO_CASE_TYPE[activeDepartment] || 'LabCase',
        collectionCentre: 'Main',
        onlineReportRequested: patientForm.onlineReportRequested,
        discountPercent: discountMode === 'percent' && discountPercentNum > 0
      });

      if (res.success) {
        clearBookingPrefill();
        clearPatientDraft();
        clearBillDraft();
        onBillCreated?.();
        // The Bills page shows a "saved" bar with the next steps for this bill.
        const saved = res.data?.bill || res.data || {};
        navigate('/cases/bills', { state: { savedBill: {
          _id: saved._id, billNumber: saved.billNumber, department: saved.department,
          patientId: saved.patient?._id || saved.patient || patientId,
          patientName: saved.patient?.name || [patientForm.patientFirstName, patientForm.patientLastName].filter(Boolean).join(' '),
          phone: saved.patient?.phone || patientForm.patientPhone || ''
        } } });
      }
    } catch (err) {
      setErrors({ api: getApiErrorMessage(err, 'Failed to generate invoice') });
    } finally {
      setSubmitting(false);
    }
  };

  const catalogDepartment = ['ALL', 'OUTSOURCE LAB'].includes(activeDepartment) ? 'ALL' : activeDepartment;
  const deptTestList = filterTestsByDepartment(tests, catalogDepartment);
  const deptPackages = filterTestsByDepartment(packages, catalogDepartment);
  const deptPanels = filterTestsByDepartment(panels, catalogDepartment);

  // Picker source per active tab — All merges tests + packages + panels.
  const activeOnly = (list) => (Array.isArray(list) ? list : [])
    .filter((item) => !item.isDeleted && (!item.status || item.status === 'Active'));
  submitRef.current = handleSubmit;
  const pickerItems = (() => {
    if (activeDepartment === 'USG') return usgServices.map(service => ({ ...service, _pickerKind: 'USG', _pickerLabel: 'USG' }));
    if (pickerType === 'All') {
      return [
        ...activeOnly(deptTestList).map((t) => ({ ...t, _pickerKind: 'Test', _pickerLabel: 'Test' })),
        ...activeOnly(deptPackages).map((p) => ({ ...p, _pickerKind: 'TestPackage', _pickerLabel: 'Package' })),
        ...activeOnly(deptPanels).map((p) => ({ ...p, _pickerKind: 'TestPanel', _pickerLabel: 'Panel' }))
      ];
    }
    if (pickerType === 'TestPackage') {
      return activeOnly(deptPackages).map((p) => ({ ...p, _pickerKind: 'TestPackage', _pickerLabel: 'Package' }));
    }
    if (pickerType === 'TestPanel') {
      return activeOnly(deptPanels).map((p) => ({ ...p, _pickerKind: 'TestPanel', _pickerLabel: 'Panel' }));
    }
    return activeOnly(deptTestList).map((t) => ({ ...t, _pickerKind: 'Test', _pickerLabel: 'Test' }));
  })();
  // Local filter first; server results used only when local has no matches.
  const pickerQ = pickerQuery.trim();
  const localFiltered = pickerQ
    ? pickerItems.filter((item) => matchesPickerQuery(item, pickerQ))
    : pickerItems;
  const usingServerResults =
    activeDepartment !== 'USG' && (pickerType === 'Test' || pickerType === 'All') && pickerQ.length > 0 && localFiltered.length === 0;
  // Returning patient: offer last visit's tests as one click.
  const [lastVisit, setLastVisit] = useState(null);
  const lastVisitPatientId = !isEditMode ? pickedPatient?._id || null : null;
  useEffect(() => {
    setLastVisit(null);
    if (!lastVisitPatientId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const list = await getBills({ patientId: lastVisitPatientId, limit: 1 });
        const last = (list?.data?.bills || list?.data || [])[0];
        if (!last?._id || cancelled) return;
        const full = await getBillById(last._id);
        const items = (full?.data?.items || []).filter((item) => item && item.itemId && ['Test', 'TestPanel', 'TestPackage'].includes(item.itemType));
        if (!cancelled && items.length) setLastVisit({ date: last.date || last.createdAt, items });
      } catch { /* the shortcut is optional */ }
    })();
    return () => { cancelled = true; };
  }, [lastVisitPatientId]);
  // Evaluated while rendering (after every helper below is defined).
  const lastVisitPendingItems = () => (lastVisit && activeDepartment !== 'USG'
    ? lastVisit.items.map((item) => pickerItems.find((candidate) => String(candidate._id) === String(item.itemId?._id || item.itemId) && (candidate._pickerKind || 'Test') === item.itemType)).filter(Boolean)
    : []).filter((item) => !isPickerItemAdded(item));

  const filteredPickerItems = usingServerResults
    ? activeOnly(filterTestsByDepartment(serverResults || [], catalogDepartment)).map((t) => ({ ...t, _pickerKind: 'Test', _pickerLabel: 'Test' }))
    : localFiltered;

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
  }, [usingServerResults, pickerQ, activeDepartment]);

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const pickerEmptyText = serverSearching
    ? 'Searching catalog…'
    : pickerQ
      ? `No matches for “${pickerQ}”.`
      : pickerType === 'All'
        ? 'No tests, packages or panels available.'
        : pickerType === 'Test'
          ? `No tests mapped under ${activeDepartment}`
          : pickerType === 'TestPackage'
            ? 'No packages available.'
            : 'No panels available.';

  const handlePickerSelect = (item) => {
    const kind = item._pickerKind || pickerType;
    if (kind === 'USG') {
      setSelectedItems([{ itemId: item._id, itemType: 'Test', name: item.name, price: item.price, _key: item.value }]);
      requestAnimationFrame(revealCart);
      return;
    }
    if (kind === 'Test') {
      handleAddItem(item, 'Test');
      return;
    }
    handleSelectBundle(item, kind === 'TestPanel' ? 'panels' : 'packages');
  };

  const isPickerItemAdded = (item) => {
    const kind = item._pickerKind || pickerType;
    if (kind === 'USG') return selectedItems.length === 1 && selectedItems[0].name === item.name;
    if (kind === 'Test') {
      return selectedItems.some((si) => si.itemId === item._id && si.itemType === 'Test');
    }
    return selectedBundleIds.includes(item._id);
  };

  const formCollectionCentreOptions = (() => {
    const names = (branches || [])
      .map((b) => b?.name)
      .filter((n) => typeof n === 'string' && n.trim())
      .filter((n, i, arr) => arr.indexOf(n) === i);
    const base = ['Main', ...names.filter((n) => n !== 'Main')];
    const list = base.includes(editCollectionCentre) ? base : [...base, editCollectionCentre];
    return list.map((n) => ({ value: n, label: n }));
  })();

  return (
    <div>
      {isV2 ? (
        <div className="bill-head">
          <button type="button" className="bill-back-link" onClick={() => (isEditMode && onCancelEdit ? onCancelEdit() : navigate('/cases/bills'))} aria-label="Back to bills">
            <ArrowLeft size={15} /> Bills
          </button>
          <span className="bill-head-sep" aria-hidden="true">/</span>
          <h1 className="bill-head-title">{isEditMode ? `Edit bill ${editBill.billNumber || ''}`.trim() : 'New bill'}</h1>
          {!isEditMode && <PageTip path="/cases/bills/new" inline />}
        </div>
      ) : null}
      {isV2 && restoredDraft && (
        <div className="bill-restored" role="status">
          Your unsaved bill was brought back.
          <button type="button" onClick={() => { clearBillDraft(); clearPatientDraft(); window.location.reload(); }}>Start over</button>
        </div>
      )}
      {!isV2 && (
      <Button
        variant="secondary"
        onClick={() => (isEditMode && onCancelEdit ? onCancelEdit() : navigate('/cases/bills'))}
        icon={<ArrowLeft size={16} />}
        style={{ marginBottom: 'var(--space-5)' }}
      >
        Back to Ledger
      </Button>
      )}

      {!isV2 && (
      <PageHeader
        title={isEditMode ? `Edit Bill Invoice ${editBill.billNumber || ''}` : 'Create Bill Invoice'}
        subtitle={isEditMode ? 'Update billed services — lab records sync automatically' : 'Record diagnostic orders and invoice payments'}
      />
      )}

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
          role="status"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-warning-bg, #fef9c3)',
            color: 'inherit',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-sm)'
          }}
        >
          Added from booking as custom lines (not in catalog): {unmatchedBookingItems.join(', ')}. Rates are from the booking — edit the cart if needed.
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

      <div ref={gridRef} className={`bill-form-grid${isV2 ? ' bill-form-grid--v2' : ''}`}>
        {/* Left Column */}
        <div className="bill-form-main" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {isEditMode ? (
            <div className="bill-form-card bill-step-patient">
              <div className="bill-card-header">
                <div className="bill-card-header-left">
                  <span className="bill-card-step-badge">1</span>
                  <h3 className="bill-card-title">Patient details</h3>
                </div>
              </div>
              {isAdmin ? <>
                <Input id="invoice-patient-name" label="Patient name" value={identity.name} onChange={e => setIdentity(prev => ({ ...prev, name: e.target.value }))} disabled={identityBusy} required />
                <Input id="invoice-patient-phone" label="Phone number" value={identity.phone} onChange={e => setIdentity(prev => ({ ...prev, phone: e.target.value }))} disabled={identityBusy} required />
                <Button variant="secondary" onClick={saveIdentity} loading={identityBusy} disabled={identityBusy || !editPatientId}>Save patient details</Button>
                {identityMessage && <p role={identityMessage.error ? 'alert' : 'status'} style={{ color: identityMessage.error ? '#b91c1c' : '#166534' }}>{identityMessage.text}</p>}
              </> : <>
              <div className="payment-summary-row">
                <span>Patient</span>
                <strong>
                  {editPatient?.name || '—'}
                  {editPatient?.registrationNumber ? ` (${editPatient.registrationNumber})` : ''}
                </strong>
              </div>
              <div className="payment-summary-row">
                <span>Phone</span>
                <strong>{editPatient?.phone || '—'}</strong>
              </div>
              <p>Only Admin can edit patient name and phone number.</p>
              </>}
              <div className="payment-summary-row">
                <span>Already paid</span>
                <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(Number(editBill.paidAmount || 0))}</strong>
              </div>
            </div>
          ) : (
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
          )}

          {/* Referral (new look: its own visible step) */}
          {isV2 && (() => {
            const doctorList = [...doctors, ...addedDoctors.filter((d) => !doctors.some((x) => x._id === d._id))];
            const agentList = [...agents, ...addedAgents.filter((a) => !agents.some((x) => x._id === a._id))];
            const addButton = (kind) => (
              <button type="button" className="bill-inline-add" onClick={() => setQuickAdd(quickAdd === kind ? null : kind)} aria-expanded={quickAdd === kind}>
                <Plus size={13} /> New {kind}
              </button>
            );
            return (
              <div className="bill-form-card bill-step-referral">
                <div className="bill-referral-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div className="bill-field-head"><label className="form-label" htmlFor="bill-referred-by">Referred by</label>{addButton('doctor')}</div>
                    <SearchSelect id="bill-referred-by" value={selectedDoctor} onChange={setSelectedDoctor} ariaLabel="Referred by"
                      options={doctorList.map((d) => ({ value: d._id, label: d.name, hint: d.clinicHospital || d.phone }))} emptyLabel="Self / walk-in" placeholder="Type doctor name or phone" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div className="bill-field-head"><label className="form-label" htmlFor="bill-agent">Collection agent</label>{addButton('agent')}</div>
                    <SearchSelect id="bill-agent" value={selectedAgent} onChange={setSelectedAgent} ariaLabel="Collection agent"
                      options={agentList.map((a) => ({ value: a._id, label: a.name, hint: a.phone }))} emptyLabel="No agent" placeholder="Type agent name or phone" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Case Details Card */}
          <div className="bill-form-card bill-step-tests">
            <div className="bill-card-header">
              <div className="bill-card-header-left">
                <span className="bill-card-step-badge">{isV2 ? 3 : 2}</span>
                <h3 className="bill-card-title">{isV2 ? 'Add tests' : 'Case Details'}</h3>
              </div>
              {isV2 && (
                <div className="bill-tests-tools">
                  <DepartmentSelector compact activeDepartment={activeDepartment} tests={tests} packages={packages} panels={panels}
                    existingDepartment={editBill?.department}
                    onSelect={(d) => { setActiveDepartment(d); setPickerQuery(''); }} />
                  {/* Opens the add form only; closing it changes nothing. */}
                  <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />} className="bill-outsource-btn"
                    onClick={() => setOutsourceOpen(true)}>
                    Outsource test
                  </Button>
                </div>
              )}
            </div>

            {!isV2 && (
              <>
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
            <DepartmentSelector
              activeDepartment={activeDepartment}
              tests={tests}
              packages={packages}
              panels={panels}
              existingDepartment={editBill?.department}
              onSelect={(d) => {
                setActiveDepartment(d);
                setPickerQuery('');
                if (d === 'OUTSOURCE LAB') setOutsourceOpen(true);
              }}
            />

              </>
            )}
            {activeDepartment === 'OUTSOURCE LAB' && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-background)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)'
                }}
              >
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  Outsource / send-out tests: enter the test name and rate. They appear on the bill as billed.
                  On Today&apos;s Reports, upload the external PDF or image — no in-lab result entry.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<ExternalLink size={14} />}
                  onClick={() => setOutsourceOpen(true)}
                >
                  Add outsource test (name + rate)
                </Button>
              </div>
            )}

            {/* Single search: local catalog first, server fallback for tests */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className={`form-label${isV2 && activeDepartment !== 'OUTSOURCE LAB' ? ' sr-only' : ''}`} htmlFor="bill-test-search" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                {activeDepartment === 'OUTSOURCE LAB' ? 'Or pick from catalog (optional)' : isV2 ? 'Type a test name (e.g. CBC) and press Enter' : 'Select services'}
              </label>
              {activeDepartment !== 'USG' && !isV2 && <div role="radiogroup" aria-label="Show" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                {PICKER_TABS.map((tab, tabIndex) => (
                  <Button
                    key={tab.key}
                    variant={pickerType === tab.key ? 'primary' : 'secondary'}
                    size="sm"
                    role="radio"
                    aria-checked={pickerType === tab.key}
                    tabIndex={pickerType === tab.key ? 0 : -1}
                    onKeyDown={(event) => rovingKeyDown(event, PICKER_TABS.length, tabIndex, (next) => { setPickerType(PICKER_TABS[next].key); setPickerQuery(''); })}
                    onClick={() => { setPickerType(tab.key); setPickerQuery(''); }}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>}
              {activeDepartment === 'USG' && <p className="form-helper">Choose one USG service. Rates are loaded from the test catalog.</p>}
              {activeDepartment === 'USG' && usgError && <p role="alert">{usgError} <Button variant="secondary" size="sm" onClick={() => setUSGRetry(value => value + 1)}>Retry</Button></p>}
              {(() => { const lastVisitPending = lastVisitPendingItems(); return lastVisitPending.length > 0 && (
                <div className="bill-repeat-last">
                  <span>Last visit{lastVisit?.date ? ` (${new Date(lastVisit.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})` : ''}: {lastVisitPending.map((item) => item.name).join(', ')}</span>
                  <Button variant="secondary" size="sm" onClick={() => lastVisitPending.forEach((item) => handlePickerSelect(item))}>Repeat</Button>
                </div>
              ); })()}
              <div className="test-picker-search" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input
                  id="bill-test-search"
                  ref={pickerInputRef}
                  onFocus={() => setPickerFocused(true)}
                  onBlur={() => setPickerFocused(false)}
                  aria-describedby="picker-keys-tip"
                  type="search"
                  className="form-control"
                  value={pickerQuery}
                  onChange={(e) => { setPickerQuery(e.target.value); setPickerHighlight(0); }}
                  onKeyDown={(e) => {
                    const choices = filteredPickerItems;
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (!choices.length) return;
                      setPickerHighlight((current) => (current + (e.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length);
                    } else if (e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                      const start = Math.min(pickerHighlight, Math.max(0, choices.length - 1));
                      const pick = [...choices.slice(start), ...choices.slice(0, start)].find((item) => !isPickerItemAdded(item));
                      if (!pick || !pickerQuery.trim()) return;
                      handlePickerSelect(pick);
                      setPickerQuery(''); setPickerHighlight(0);
                      requestAnimationFrame(() => pickerInputRef.current?.focus({ preventScroll: true }));
                    } else if (e.key === 'Escape' && pickerQuery) {
                      e.preventDefault(); setPickerQuery(''); setPickerHighlight(0);
                    }
                  }}
                  aria-activedescendant={pickerQuery && filteredPickerItems[pickerHighlight] ? `picker-option-${pickerHighlight}` : undefined}
                  placeholder={
                    activeDepartment === 'USG' ? 'Search USG services…' : isV2 ? 'Type a test name (e.g. CBC) and press Enter' : pickerType === 'All'
                      ? 'Search all tests, packages & panels…'
                      : `Search ${pickerType === 'Test' ? 'tests' : pickerType === 'TestPackage' ? 'packages' : 'panels'} by name or code…`
                  }
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
              {/* Always takes its space (only fades in while typing), so the list never moves under the mouse. */}
              {activeDepartment !== 'USG' && (
                <p id="picker-keys-tip" className={`kbd-tip${pickerFocused ? ' is-visible' : ''}`}><kbd>↑</kbd><kbd>↓</kbd> choose · <kbd>Enter</kbd> add · <kbd>Esc</kbd> clear · <kbd>Ctrl</kbd>+<kbd>B</kbd> create invoice</p>
              )}
              {/* Mouse or the search box (Up/Down/Enter) pick tests; the list is not a Tab stop. */}
              <div className="test-picker-list" tabIndex={-1}>
                {filteredPickerItems.length === 0 ? (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-5)' }}>
                    {pickerEmptyText}
                  </p>
                ) : (
                  filteredPickerItems.map((item, itemIndex) => {
                    const alreadyAdded = isPickerItemAdded(item);
                    const highlighted = !!pickerQuery && itemIndex === pickerHighlight;
                    const kind = item._pickerKind || 'Test';
                    return (
                      <div
                        key={`${kind}-${item._id}`}
                        id={`picker-option-${itemIndex}`}
                        className={`test-picker-item${highlighted ? ' is-highlighted' : ''}${alreadyAdded ? ' is-added' : ''}`}
                        ref={highlighted ? (node) => node?.scrollIntoView?.({ block: 'nearest' }) : undefined}
                        onMouseEnter={() => setPickerHighlight(itemIndex)}
                        onClick={() => !alreadyAdded && handlePickerSelect(item)}
                        role="button"
                        tabIndex={-1}
                        aria-disabled={alreadyAdded}
                        onKeyDown={(e) => { if (!alreadyAdded && e.key === 'Enter') handlePickerSelect(item); }}
                      >
                        {isV2 ? (
                          <span className="picker-row-main">
                            <span className="picker-row-name">{item.name}</span>
                            <span className="picker-row-meta">
                              {[kind !== 'USG' && item._pickerLabel, kind !== 'USG' && item.code].filter(Boolean).join(' \u00b7 ')}
                              {alreadyAdded ? <span className="picker-row-added">Added</span> : null}
                            </span>
                          </span>
                        ) : (
                        <span>
                          {kind !== 'USG' && pickerType === 'All' && item._pickerLabel ? (
                            <span style={{ color: 'var(--color-text-muted)', marginRight: '0.35rem' }}>
                              [{item._pickerLabel}]
                            </span>
                          ) : null}
                          {item.name}
                          {kind !== 'USG' && item.code ? ` (${item.code})` : ''}
                          {alreadyAdded ? ' — Added' : ''}
                        </span>
                        )}
                        <strong className="picker-row-price" style={isV2 ? undefined : { color: 'var(--color-primary)' }}>{formatCurrency(item.price)}</strong>
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
          <div className="bill-form-card bill-step-cart">
            <BillItemsTable
              items={selectedItems}
              onRemove={(idx) => setSelectedItems((prev) => prev.filter((_, i) => i !== idx))}
              error={errors.items}
            />
            <ComboIndicator items={selectedItems} />
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
            submitHint="Ctrl+B"
            submitting={submitting}
            isEditMode={isEditMode}
            submitLabel={isV2 ? (isEditMode ? 'Save bill' : 'Create bill') : isEditMode ? 'Save Bill' : 'Create Invoice'}
            collectionCentreOptions={formCollectionCentreOptions}
            collectionCentre={editCollectionCentre}
            setCollectionCentre={setEditCollectionCentre}
            adminOverride={editAdminOverride}
            setAdminOverride={setEditAdminOverride}
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

      {isV2 && (
        <QuickAddContact
          kind={quickAdd}
          isOpen={!!quickAdd}
          onClose={() => setQuickAdd(null)}
          onCreate={async (data) => (await (quickAdd === 'doctor' ? createDoctor : createAgent)(data)).data}
          onCreated={(item) => {
            if (!item?._id) return;
            if (quickAdd === 'doctor') { setAddedDoctors((list) => [...list, item]); setSelectedDoctor(item._id); }
            else { setAddedAgents((list) => [...list, item]); setSelectedAgent(item._id); }
            notify(`${item.name} added`);
            setQuickAdd(null);
          }}
        />
      )}

      <OutsourceTestModal
        isOpen={outsourceOpen}
        onClose={() => setOutsourceOpen(false)}
        onAdd={handleAddOutsourceTest}
      />
    </div>
  );
};

export default BillCreateForm;
