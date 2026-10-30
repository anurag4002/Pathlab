import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Download,
  Eye,
  X,
  Lock,
  ArrowLeft,
  AlertCircle,
  Clock,
  User,
  Calendar,
  ExternalLink,
  ClipboardList,
  Plus,
  CalendarPlus,
  CheckCircle,
  Phone,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  Search,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import {
  requestOtp,
  loginWithBirthYear,
  verifyOtp,
  getPatientReports,
  downloadPatientReport,
  patientLogout,
  registerPatientProfile,
  getBookingCatalog,
  createBookingInquiry,
  getMyBookingInquiries
} from '../../services/patientPortalService';
import formatDate from '../../utils/formatDate';
import formatCurrency from '../../utils/formatCurrency';
import { PublicHeader, PublicFooter, LAB_PHONE_LINK } from '../../components/public/PublicLayout';
import './PatientPortal.css';

// The patient contract may expose the existing LabProfile.googleReviewLink
// field. Do not call staff-only profile/review endpoints from this portal.
const getConfiguredGoogleReviewUrl = (response) => {
  const value = [response?.googleReviewLink, response?.data?.googleReviewLink]
    .find((candidate) => typeof candidate === 'string' && candidate.trim());
  if (!value) return '';

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const isGoogleHost = hostname === 'google.com' || hostname.endsWith('.google.com') || hostname === 'g.page' || hostname.endsWith('.g.page');
    const destination = `${url.pathname} ${url.search}`.toLowerCase();
    const hasReviewDestination = /review|writereview|placeid|maps/.test(destination);
    if (url.protocol !== 'https:' || !isGoogleHost || url.username || url.password) return '';
    if (!hasReviewDestination && hostname !== 'g.page' && !hostname.endsWith('.g.page')) return '';
    return url.toString();
  } catch {
    return '';
  }
};

const isPatientReportReviewEligible = (report) => {
  const status = String(report?.status || '').toLowerCase();
  const type = String(report?.type || '').toLowerCase();
  if (type === 'pathology') return status === 'completed' || status === 'signed' || status === 'verified';
  if (type === 'usg' || type === 'digital x-ray') return status === 'completed' || status === 'verified';
  return false;
};

const INQUIRY_STATUS_STYLE = {
  New: '#1d4ed8',
  Contacted: '#b06000',
  Confirmed: '#137333',
  Cancelled: '#5f6368'
};

const PatientReportPortal = () => {
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') === 'book' ? 'book' : 'reports';
  const requestedTest = searchParams.get('test');
  const requestedPackage = searchParams.get('package');
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 2.5: Register, 3: Home
  const [phone, setPhone] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [loginMethod, setLoginMethod] = useState('birthYear');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [profiles, setProfiles] = useState([]);
  // Dev-only: backend echoes the OTP when not in production so testers can
  // proceed without a configured SMS provider. Never present in prod.
  const [devOtp, setDevOtp] = useState('');

  // Registration (new numbers)
  const [regForm, setRegForm] = useState({ name: '', age: '', gender: '', address: '' });

  // Home tabs
  const [tab, setTab] = useState(requestedTab); // reports | book | mine
  const [reports, setReports] = useState([]);
  const [fetchingReports, setFetchingReports] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [selectedReport, setSelectedReport] = useState(null);
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [pdfNotice, setPdfNotice] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [reportSearch, setReportSearch] = useState('');
  const [reportFilter, setReportFilter] = useState('all');
  const [reportPatient, setReportPatient] = useState('all');
  const reportDialogRef = useRef(null);

  const readyReports = reports.filter(report => report.downloadable !== false).length;
  const processingReports = reports.filter(report => report.downloadable === false && /^(processing|pending|registered|collected|draft)$/i.test(report.status || '')).length;
  const reportPatients = [...new Set(reports.map(report => report.patientName).filter(Boolean))];
  const visibleReports = useMemo(() => reports.filter(report => {
    const matchesSearch = `${report.testName || ''} ${report.patientName || ''} ${report.registrationNumber || ''} ${report.type || ''}`.toLowerCase().includes(reportSearch.trim().toLowerCase());
    const matchesFilter = reportFilter === 'all' || (reportFilter === 'ready' ? report.downloadable !== false : report.downloadable === false && /^(processing|pending|registered|collected|draft)$/i.test(report.status || ''));
    return matchesSearch && matchesFilter && (reportPatient === 'all' || report.patientName === reportPatient);
  }).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)), [reports, reportSearch, reportFilter, reportPatient]);
  const resetReportFilters = () => { setReportSearch(''); setReportFilter('all'); setReportPatient('all'); };

  useEffect(() => {
    if (!selectedReport) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = reportDialogRef.current;
    dialog?.querySelector('button')?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') setSelectedReport(null);
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [selectedReport]);

  // Booking
  const [catalog, setCatalog] = useState({ tests: [], packages: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [selected, setSelected] = useState({}); // key -> { kind, refId, name, price }
  const [bookFor, setBookFor] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [bookNote, setBookNote] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingDone, setBookingDone] = useState('');

  // My bookings
  const [inquiries, setInquiries] = useState([]);
  const [fetchingInquiries, setFetchingInquiries] = useState(false);

  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  const loadReports = async () => {
    setFetchingReports(true);
    setError('');
    setGoogleReviewUrl('');
    try {
      const res = await getPatientReports();
      if (res.success) {
        setReports(Array.isArray(res.data) ? res.data : []);
        setGoogleReviewUrl(getConfiguredGoogleReviewUrl(res));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load diagnostic reports.');
    } finally {
      setFetchingReports(false);
    }
  };

  const loadInquiries = async () => {
    setFetchingInquiries(true);
    try {
      const res = await getMyBookingInquiries();
      if (res.success) setInquiries(res.data || []);
    } catch (err) {
      console.error('Failed to load bookings', err);
    } finally {
      setFetchingInquiries(false);
    }
  };

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await getBookingCatalog();
      if (res.success) {
        const next = res.data || { tests: [], packages: [] };
        setCatalog(next);
        const item = requestedPackage ? (next.packages || []).find(item => String(item._id) === requestedPackage)
          : requestedTest ? (next.tests || []).find(item => String(item._id) === requestedTest) : null;
        if (item) {
          const key = `${requestedPackage ? 'pkg' : 'test'}-${item._id}`;
          setSelected(previous => ({ ...previous, [key]: { kind: requestedPackage ? 'Package' : 'Test', refId: item._id, name: item.name, price: item.price } }));
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load bookable tests.');
    } finally {
      setCatalogLoading(false);
    }
  }, [requestedPackage, requestedTest]);

  const openTab = (t) => {
    setTab(t);
    document.querySelector('.patient-dashboard-panel')?.scrollIntoView({ block: 'start' });
    setError('');
    setBookingDone('');
    if (t === 'book' && catalog.tests.length === 0 && catalog.packages.length === 0) loadCatalog();
    if (t === 'mine') loadInquiries();
    if (t === 'reports' && reports.length === 0) loadReports();
  };

  useEffect(() => {
    const token = sessionStorage.getItem('ppl_patient_token');
    const savedPhone = sessionStorage.getItem('ppl_patient_phone');
    if (token && savedPhone) {
      setPhone(savedPhone);
      setStep(3);
      loadReports();
      loadInquiries();
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    setTab(requestedTab);
    if (requestedTab === 'book' && sessionStorage.getItem('ppl_patient_token')) loadCatalog();
  }, [requestedTab, loadCatalog]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const handleBirthYearLogin = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await loginWithBirthYear(phone, birthYear);
      if (response.success) {
        setProfiles(response.data.patients || []); setStep(3); setTab(requestedTab);
        loadReports(); loadInquiries();
        if (requestedTab === 'book') loadCatalog();
      }
    } catch (error) { setError(error.response?.data?.message || 'Unable to log in'); }
    finally { setLoading(false); }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Never blocked: OTP is issued for any valid number, new or existing.
      const res = await requestOtp(cleanPhone);
      if (res.success) {
        setIsNewNumber(!!res.data?.isNew);
        setDevOtp(res.data?.devOtp || '');
        setStep(2);
        setResendTimer(30);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to dispatch OTP. Please verify your mobile number.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) {
      // Cleared the box.
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }
    // Fill this box onward (handles typing one digit AND pasting all six).
    const newOtp = [...otp];
    for (let i = 0; i < digits.length && index + i < 6; i += 1) {
      newOtp[index + i] = digits[i];
    }
    setOtp(newOtp);

    // Focus the next empty box (or the last one when all filled).
    const nextEmpty = newOtp.findIndex((d) => !d);
    const focusIdx = nextEmpty === -1 ? 5 : nextEmpty;
    const el = document.getElementById(`otp-input-${focusIdx}`);
    if (el) el.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      setError('Please enter the 6-digit OTP sent to your phone.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await verifyOtp(phone, otpCode);
      if (res.success) {
        setDevOtp('');
        const list = res.data?.patients || [];
        setProfiles(list);
        setIsNewNumber(!!res.data?.isNew || list.length === 0);
        if (!res.data?.isNew && list.length > 0) {
          setStep(3);
          setTab(requestedTab);
          loadReports();
          loadInquiries();
          if (requestedTab === 'book') loadCatalog();
        } else {
          // New number (or no profile yet): create the patient profile first.
          setRegForm({ name: '', age: '', gender: '', address: '' });
          setStep(2.5);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regForm.name.trim()) {
      setError('Please enter the patient full name.');
      return;
    }
    const ageNum = Number(regForm.age);
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 130) {
      setError('Please enter a valid age.');
      return;
    }
    if (!['Male', 'Female', 'Other'].includes(regForm.gender)) {
      setError('Please select gender.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await registerPatientProfile({
        name: regForm.name.trim(),
        age: Math.floor(ageNum),
        gender: regForm.gender,
        address: regForm.address.trim()
      });
      if (res.success) {
        setProfiles([res.data]);
        setBookFor(res.data?.name || '');
        setStep(3);
        setTab(requestedTab);
        loadReports();
        loadInquiries();
        if (requestedTab === 'book') loadCatalog();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (key, entry) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = entry;
      return next;
    });
  };

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const selectedTotal = useMemo(
    () => selectedList.reduce((s, it) => s + (Number(it.price) || 0), 0),
    [selectedList]
  );

  const filteredCatalog = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    const match = (n) => !q || String(n || '').toLowerCase().includes(q);
    return {
      tests: (catalog.tests || []).filter((t) => match(t.name) || match(t.code)),
      packages: (catalog.packages || []).filter((p) => match(p.name))
    };
  }, [catalog, bookSearch]);

  const handleBook = async (e) => {
    e.preventDefault();
    setError('');
    setBookingDone('');
    if (selectedList.length === 0) {
      setError('Select at least one test or package to book.');
      return;
    }
    setBookingLoading(true);
    try {
      const res = await createBookingInquiry({
        name: bookFor.trim() || profiles[0]?.name || regForm.name.trim(),
        patientId: profiles[0]?._id,
        items: selectedList,
        preferredDate: preferredDate || undefined,
        note: bookNote.trim() || undefined
      });
      if (res.success) {
        setBookingDone(`Booking received${res.data?._id ? ` (#${String(res.data._id).slice(-6).toUpperCase()})` : ''}. Please pay at the lab counter — no online payment is needed.`);
        setSelected({});
        setBookNote('');
        loadInquiries();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleDownload = async (report) => {
    setDownloadingId(report.id); setPdfNotice(''); setDownloadError('');
    try {
      const fileName = `${report.type}_Report_${report.registrationNumber}.pdf`;
      await downloadPatientReport(report.id, fileName);
      setPdfNotice(`Report PDF download started for ${report.registrationNumber || 'report'}.`);
    } catch {
      setPdfNotice('');
      setDownloadError('Couldn’t download the PDF. Please try again, or contact the lab for help.');
    } finally { setDownloadingId(null); }
  };

  const handleLogout = () => {
    patientLogout();
    setStep(1);
    setPhone('');
    setBirthYear('');
    setDevOtp('');
    setOtp(['', '', '', '', '', '']);
    setReports([]);
    setProfiles([]);
    setIsNewNumber(false);
    setSelectedReport(null);
    setGoogleReviewUrl('');
    setSelected({});
    resetReportFilters(); setPdfNotice(''); setDownloadError('');
    setInquiries([]);
    setTab(requestedTab);
    setCatalog({ tests: [], packages: [] });
    setBookSearch('');
    setBookFor('');
    setPreferredDate('');
    setBookNote('');
    setBookingDone('');
  };

  const showGoogleReview = isPatientReportReviewEligible(selectedReport);

  return (
    <div className="public-site patient-public-page">
      <PublicHeader active={(step === 3 ? tab === 'book' : requestedTab === 'book') ? 'book' : 'reports'} />
      <main id="public-main" className={`patient-portal-container ${step === 3 ? 'patient-workspace' : 'patient-sign-in'}`}>
      <div className="patient-portal-nav">
        <Link to="/" className="patient-back-link"><ArrowLeft size={14} /><span>Home</span></Link>
        <span>/</span><span>{step === 3 ? (tab === 'book' ? 'Book a test' : tab === 'mine' ? 'My bookings' : 'My reports') : requestedTab === 'book' ? 'Book a test' : 'My reports'}</span>
      </div>
      <div className={step !== 3 ? 'patient-auth-shell' : 'patient-workspace-content'}>
      {step !== 3 ? <section className="patient-intro">
        <span className="public-eyebrow">YOUR PATIENT SPACE</span>
        <h1>{requestedTab === 'book' ? <>A little planning.<br />{' '}<span>A little more care.</span></> : <>Your reports.<br />{' '}<span>Closer to you.</span></>}</h1>
        <p>Your latest reports, your next test, and your family’s bookings. One familiar place to find them.</p>
        <ul>
          <li><span><FileText size={19} /></span><div><strong>Know when your report is ready</strong><p>Check its status without a trip to the lab.</p></div></li>
          <li><span><Download size={19} /></span><div><strong>A PDF you can keep or share</strong><p>Download your completed reports to your phone.</p></div></li>
          <li><span><CalendarPlus size={19} /></span><div><strong>A little care for the whole family</strong><p>Request tests for yourself or a family member.</p></div></li>
        </ul>
        <div className="patient-access-preview" aria-hidden="true">
          <span className="patient-preview-icon"><FileText size={24} /></span>
          <div><strong>Your care, in your hands</strong><span>View a report. Keep a PDF. Plan a visit.</span></div>
          <ShieldCheck size={21} />
        </div>
      </section> : <div className="patient-workspace-heading"><div><span className="public-eyebrow">{profiles[0]?.name ? `Hello, ${profiles[0].name}` : 'YOUR PATIENT SPACE'}</span><h1>{tab === 'book' ? 'Plan your next visit.' : tab === 'mine' ? 'Your bookings, at a glance.' : 'Your reports, all together.'}</h1><p>{tab === 'book' ? 'Choose your tests and send a request. The lab team will confirm your visit.' : tab === 'mine' ? 'Track your requests and see what happens next.' : 'Find a report, check its progress, or keep a PDF for later.'}</p></div><div className="patient-session-actions"><span>+91 {phone}</span><button type="button" className="patient-logout-btn" onClick={handleLogout}>Sign out</button></div></div>}

      {step === 1 && (
        <div className="patient-card">
          <span className="patient-auth-eyebrow"><Lock size={14} /> PATIENT SIGN IN</span>
          <h2 className="patient-step-title">Sign in to continue</h2>
          <p className="patient-step-desc">Choose how you’d like to sign in.</p>
          <div className="patient-login-methods" role="group" aria-label="Sign-in method">
            <button type="button" aria-pressed={loginMethod === 'birthYear'} disabled={loading} onClick={() => { setLoginMethod('birthYear'); setError(''); }}><Calendar size={16} /> Birth year</button>
            <button type="button" aria-pressed={loginMethod === 'otp'} disabled={loading} onClick={() => { setLoginMethod('otp'); setError(''); }}><MessageSquare size={16} /> Mobile OTP</button>
          </div>

          {error && (
            <div className="patient-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={loginMethod === 'otp' ? handleRequestOtp : handleBirthYearLogin} className="patient-form">
            <div className="patient-form-group">
              <label htmlFor="patient-phone" className="patient-form-label">Mobile Number</label>
              <div className="patient-input-prefix">
                <span className="patient-phone-flag">+91</span>
                <input
                  id="patient-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  pattern="[0-9]{10}"
                  aria-describedby="patient-phone-help"
                  className="patient-phone-input"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  required
                />
              </div>
              <small id="patient-phone-help" className="patient-field-hint">{loginMethod === 'otp' ? 'Enter a number you can receive messages on.' : 'Use the number registered at the lab.'}</small>
            </div>

            {loginMethod === 'birthYear' && <div className="patient-form-group">
              <label htmlFor="patient-birth-year" className="patient-form-label">Birth Year</label>
              <input id="patient-birth-year" autoComplete="bday-year" className="patient-phone-input" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="e.g. 1990" value={birthYear} onChange={event => setBirthYear(event.target.value.replace(/\D/g, ''))} required aria-describedby="patient-year-help" />
              <small id="patient-year-help" className="patient-field-hint">The 4-digit year you were born, as given at the lab.</small>
            </div>}
            {loginMethod === 'otp' && <p className="patient-otp-explainer"><MessageSquare size={17} /><span>We’ll send a 6-digit code to this number. New patients can create a profile after verification.</span></p>}
            <button type="submit" className="patient-btn patient-sign-in-submit" disabled={loading}>
              {loading ? (loginMethod === 'otp' ? 'Sending code…' : 'Signing in…') : loginMethod === 'otp' ? 'Send verification code' : requestedTab === 'book' ? 'Continue to booking' : 'View my reports'} <ArrowRight size={17} />
            </button>
          </form>

          {loginMethod === 'birthYear' && <p className="patient-new-patient">New to Pure Path Lab, or unsure of your birth year?<button type="button" disabled={loading} onClick={() => { setLoginMethod('otp'); setError(''); }}>Continue with mobile OTP <ArrowRight size={14} /></button></p>}
          <div className="patient-security-note"><ShieldCheck size={15} /><span>Your reports are available after patient sign-in.</span></div>
        </div>
      )}

      {step === 2 && (
        <div className="patient-card">
          <div className="patient-card-icon-header">
            <Lock size={24} />
          </div>
          <span className="patient-auth-eyebrow">VERIFY YOUR MOBILE</span>
          <h2 className="patient-step-title">Check your phone</h2>
          <p className="patient-step-desc">
            Enter the 6-digit OTP sent to <strong>+91 {phone}</strong>
            {isNewNumber && (
              <span className="patient-new-hint"> · New number — you&apos;ll create your profile on the next step.</span>
            )}
          </p>

          {error && (
            <div className="patient-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {devOtp && (
            <div className="patient-dev-otp" role="status">
              <span className="patient-dev-otp-label">DEV MODE — your test OTP:</span>
              <strong className="patient-dev-otp-code" data-testid="dev-otp-code">{devOtp}</strong>
              <button
                type="button"
                className="patient-btn patient-btn-secondary"
                data-testid="use-dev-otp"
                aria-label="Use test OTP"
                onClick={() => {
                  const digits = String(devOtp).replace(/\D/g, '').slice(0, 6).split('');
                  while (digits.length < 6) digits.push('');
                  setOtp(digits);
                  setError('');
                }}
              >
                Use test OTP
              </button>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="patient-form">
            <div className="otp-digit-container">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-input-${idx}`}
                  aria-label={`OTP digit ${idx + 1}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="otp-digit-input"
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={(e) => {
                    e.preventDefault();
                    handleOtpChange(idx, e.clipboardData.getData('text'));
                  }}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <button type="submit" className="patient-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>

          <div className="patient-resend-box">
            {resendTimer > 0 ? (
              <span className="patient-timer-text">
                <Clock size={13} /> Resend OTP in <strong>{resendTimer}s</strong>
              </span>
            ) : (
              <button type="button" className="patient-link-btn" onClick={handleRequestOtp} disabled={loading}>
                Resend OTP
              </button>
            )}
            <span className="patient-dot-sep">•</span>
            <button type="button" className="patient-link-btn" onClick={() => { setStep(1); setDevOtp(''); setOtp(['', '', '', '', '', '']); setError(''); setLoginMethod('otp'); }}>
              Change Number
            </button>
          </div>
        </div>
      )}

      {step === 2.5 && (
        <div className="patient-card">
          <div className="patient-card-icon-header">
            <User size={24} />
          </div>
          <h2 className="patient-step-title">Create your patient profile</h2>
          <p className="patient-step-desc">
            No profile found for <strong>+91 {phone}</strong>. Add your details to create one — it takes a few seconds.
          </p>

          {error && (
            <div className="patient-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="patient-form">
            <div className="patient-form-group">
              <label htmlFor="reg-name" className="patient-form-label">Full Name *</label>
              <input
                id="reg-name"
                type="text"
                className="patient-text-input"
                placeholder="e.g. Meera Deshmukh"
                value={regForm.name}
                onChange={(e) => setRegForm((s) => ({ ...s, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="patient-form-row">
              <div className="patient-form-group">
                <label htmlFor="reg-age" className="patient-form-label">Age *</label>
                <input
                  id="reg-age"
                  type="number"
                  min="0"
                  max="130"
                  className="patient-text-input"
                  placeholder="e.g. 34"
                  value={regForm.age}
                  onChange={(e) => setRegForm((s) => ({ ...s, age: e.target.value }))}
                  required
                />
              </div>
              <div className="patient-form-group">
                <label htmlFor="reg-gender" className="patient-form-label">Gender *</label>
                <select
                  id="reg-gender"
                  className="patient-text-input"
                  value={regForm.gender}
                  onChange={(e) => setRegForm((s) => ({ ...s, gender: e.target.value }))}
                  required
                >
                  <option value="">Select…</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="patient-form-group">
              <label htmlFor="reg-address" className="patient-form-label">Address (optional)</label>
              <input
                id="reg-address"
                type="text"
                className="patient-text-input"
                placeholder="Street, area, city"
                value={regForm.address}
                onChange={(e) => setRegForm((s) => ({ ...s, address: e.target.value }))}
              />
            </div>

            <button type="submit" className="patient-btn" disabled={loading}>
              {loading ? 'Creating profile...' : 'Create Profile & Continue'}
            </button>
            <button type="button" className="patient-link-btn" disabled={loading} onClick={() => { patientLogout(); setStep(1); setError(''); setOtp(['', '', '', '', '', '']); setLoginMethod('otp'); }}>Use a different mobile number</button>
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="patient-dashboard">
          <div className="patient-overview" aria-label="Your patient overview">
            <button type="button" onClick={() => { openTab('reports'); setReportFilter('ready'); setReportPatient('all'); setReportSearch(''); }}><span className="patient-stat-icon"><Download size={21} /></span><span><small>Ready to download</small><strong>{fetchingReports ? '—' : readyReports}<span> report{readyReports === 1 ? '' : 's'}</span></strong></span><ChevronRight size={17} /></button>
            <button type="button" onClick={() => { openTab('reports'); setReportFilter('processing'); setReportPatient('all'); setReportSearch(''); }}><span className="patient-stat-icon patient-stat-amber"><Clock size={21} /></span><span><small>In progress</small><strong>{fetchingReports ? '—' : processingReports}<span> report{processingReports === 1 ? '' : 's'}</span></strong></span><ChevronRight size={17} /></button>
            <button type="button" onClick={() => openTab('mine')}><span className="patient-stat-icon patient-stat-blue"><CalendarPlus size={21} /></span><span><small>Booking requests</small><strong>{fetchingInquiries ? '—' : inquiries.length}<span> request{inquiries.length === 1 ? '' : 's'}</span></strong></span><ChevronRight size={17} /></button>
          </div>
          <div className="patient-card patient-card-wide patient-dashboard-panel">
          <div className="patient-tabs" role="tablist" aria-label="Patient sections">
            {[
              { key: 'reports', label: 'My Reports', icon: FileText },
              { key: 'book', label: 'Book a Test', icon: CalendarPlus },
              { key: 'mine', label: 'My Bookings', icon: ClipboardList }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`patient-tab${tab === key ? ' active' : ''}`}
                onClick={() => openTab(key)}
              >
                <Icon size={15} /> {label}
                {key === 'mine' && inquiries.filter((i) => i.status === 'New').length > 0 && (
                  <span className="patient-tab-count">{inquiries.filter((i) => i.status === 'New').length}</span>
                )}
              </button>
            ))}
          </div>

          {error && (
            <div className="patient-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {bookingDone && (
            <div className="patient-alert-success" role="status">
              <CheckCircle size={16} />
              <span>{bookingDone}</span>
            </div>
          )}

          {pdfNotice && !selectedReport && <p className="patient-download-notice" role="status"><CheckCircle size={16} />{pdfNotice}</p>}
          {downloadError && <p className="patient-alert-error" role="alert"><AlertCircle size={16} />{downloadError}</p>}
          {tab === 'reports' && <div className="patient-report-tools">
            <div className="patient-report-section-title"><div><h2>My reports</h2><p>Most recent first · {reports.length} report{reports.length === 1 ? '' : 's'}</p></div><button type="button" className="patient-refresh" onClick={loadReports} disabled={fetchingReports}><RefreshCw size={15} className={fetchingReports ? 'spin' : ''} /> Refresh</button></div>
            <div className="patient-report-search-row"><label className="patient-report-search"><Search size={18} /><input type="search" aria-label="Search reports" placeholder="Search by test, patient, or registration no." value={reportSearch} onChange={event => setReportSearch(event.target.value)} /></label>{reportPatients.length > 1 && <select aria-label="Filter reports by patient" value={reportPatient} onChange={event => setReportPatient(event.target.value)}><option value="all">All patients</option>{reportPatients.map(name => <option key={name} value={name}>{name}</option>)}</select>}</div>
            <div className="patient-report-filter-row"><div role="group" aria-label="Report status">{[['all', 'All reports', reports.length], ['ready', 'Ready to download', readyReports], ['processing', 'In progress', processingReports]].map(([key, label, count]) => <button key={key} type="button" aria-pressed={reportFilter === key} onClick={() => setReportFilter(key)}>{label}<span>{count}</span></button>)}</div><span role="status">{fetchingReports ? 'Loading…' : `${visibleReports.length} shown`}</span></div>
          </div>}
          {tab === 'reports' && (
            fetchingReports ? (
              <div className="patient-empty-state">
                <Clock size={28} className="spin" />
                <p>Fetching your reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="patient-empty-state">
                <FileText size={32} />
                <p>No reports yet for this mobile number. After you register at the lab, reports appear here as Processing until ready.</p>
                <small>If you recently gave a sample, please check back in a few hours — or book your first test below.</small>
                <button type="button" className="patient-btn patient-btn-narrow" onClick={() => openTab('book')}>
                  <Plus size={15} /> Book a Test
                </button>
              </div>
            ) : (
              visibleReports.length === 0 ? <div className="patient-empty-state"><Search size={30} /><h3>No matching reports</h3><p>Try another test name, patient, or status.</p><button type="button" className="patient-view-btn" onClick={resetReportFilters}>Clear filters</button></div> :
              <div className="patient-report-results" role="list" aria-label="Patient reports">
                <div className="patient-report-columns" aria-hidden="true"><span>Investigation</span><span>Patient / date</span><span>Status</span><span>Report actions</span></div>
                {visibleReports.map(report => <article key={report.id} role="listitem" className="patient-report-row">
                  <div className="patient-report-main"><span className={`patient-report-document${report.downloadable === false ? ' is-pending' : ''}`}>{report.downloadable === false ? <Clock size={20} /> : <FileText size={20} />}</span><div><h3>{report.testName}</h3><p>{report.type} <span>·</span> Reg. no. {report.registrationNumber || '—'}</p></div></div>
                  <div className="patient-report-person"><strong>{report.patientName}</strong><span>{formatDate(report.date)}</span></div>
                  <div className="patient-report-readiness"><span className={`patient-report-badge badge-${String(report.status || 'pending').toLowerCase()}`}>{report.downloadable !== false ? <CheckCircle size={12} /> : <Clock size={12} />}{report.status || 'Processing'}</span><small>{report.downloadable !== false ? 'PDF available' : 'PDF not ready yet'}</small></div>
                  <div className="patient-report-row-actions"><button type="button" className="patient-view-btn" aria-label={`View ${report.testName} for ${report.patientName}`} onClick={() => { setSelectedReport(report); setPdfNotice(''); setDownloadError(''); }}><Eye size={15} />{report.downloadable === false ? 'View status' : 'View'}</button>{report.downloadable !== false && <button type="button" className="patient-download-btn" aria-label={`Download ${report.testName} PDF for ${report.patientName}`} data-testid="report-pdf-download" disabled={downloadingId !== null} onClick={() => handleDownload(report)}><Download size={15} />{downloadingId === report.id ? 'Downloading…' : 'Download PDF'}</button>}</div>
                </article>)}
              </div>
            )
          )}

          {tab === 'book' && (
            <div>
              <p className="patient-book-note">
                Select tests or packages and send a booking inquiry. The lab will confirm by phone/SMS.
                <strong> No online payment — please pay at the lab counter.</strong>
              </p>
              <div className="patient-book-controls">
                <input
                  type="text"
                  className="patient-text-input"
                  placeholder="Search tests or packages…"
                  aria-label="Search bookable tests and packages"
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                />
              </div>
              {catalogLoading ? (
                <div className="patient-empty-state">
                  <Clock size={28} className="spin" />
                  <p>Loading bookable tests…</p>
                </div>
              ) : (
                <form onSubmit={handleBook} className="patient-booking-layout">
                  <div className="patient-catalog-list" role="region" aria-label="Available tests and packages" tabIndex={0}>
                  {filteredCatalog.packages.length > 0 && (
                    <>
                      <h4 className="patient-book-group">Health Packages</h4>
                      {filteredCatalog.packages.map((p) => {
                        const key = `pkg-${p._id}`;
                        const on = !!selected[key];
                        return (
                          <label key={key} className={`patient-select-row${on ? ' selected' : ''}`}>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggleSelect(key, { kind: 'Package', refId: p._id, name: p.name, price: p.price })}
                            />
                            <span className="patient-select-name">{p.name}</span>
                            <span className="patient-select-price">{formatCurrency(p.price)}</span>
                          </label>
                        );
                      })}
                    </>
                  )}
                  <h4 className="patient-book-group">Individual Tests</h4>
                  {filteredCatalog.tests.length === 0 ? (
                    <p className="patient-muted">No tests match your search.</p>
                  ) : (
                    filteredCatalog.tests.map((t) => {
                      const key = `test-${t._id}`;
                      const on = !!selected[key];
                      return (
                        <label key={key} className={`patient-select-row${on ? ' selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleSelect(key, { kind: 'Test', refId: t._id, name: `${t.name}${t.code ? ` (${t.code})` : ''}`, price: t.price })}
                          />
                          <span className="patient-select-name">{t.name}{t.code ? ` (${t.code})` : ''}</span>
                          <span className="patient-select-price">{formatCurrency(t.price)}</span>
                        </label>
                      );
                    })
                  )}

                  </div>
                  <div className="patient-book-foot">
                    <div className="patient-selection-title"><h3>Your selection</h3><span>{selectedList.length} item{selectedList.length === 1 ? '' : 's'}</span></div>
                    {selectedList.length ? <ul className="patient-selection-summary">{Object.entries(selected).map(([key, item]) => <li key={key}><span>{item.name}<small>{formatCurrency(item.price)}</small></span><button type="button" aria-label={`Remove ${item.name}`} onClick={() => toggleSelect(key, item)}><X size={15} /></button></li>)}</ul> : <p className="patient-selection-empty">Choose a test or package to build your booking.</p>}
                    <div className="patient-form-row">
                      <div className="patient-form-group">
                        <label className="patient-form-label" htmlFor="book-for">Booking for</label>
                        <input
                          id="book-for"
                          type="text"
                          className="patient-text-input"
                          placeholder={profiles[0]?.name || 'Patient name'}
                          value={bookFor}
                          onChange={(e) => setBookFor(e.target.value)}
                        />
                      </div>
                      <div className="patient-form-group">
                        <label className="patient-form-label" htmlFor="book-date">Preferred date (optional)</label>
                        <input
                          id="book-date"
                          type="date"
                          className="patient-text-input"
                          value={preferredDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setPreferredDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="patient-form-group">
                      <label className="patient-form-label" htmlFor="book-note">Note for the lab (optional)</label>
                      <input
                        id="book-note"
                        type="text"
                        className="patient-text-input"
                        placeholder="e.g. fasting sample, morning slot preferred"
                        value={bookNote}
                        onChange={(e) => setBookNote(e.target.value)}
                      />
                    </div>
                    <div className="patient-book-total">
                      <span>{selectedList.length} item{selectedList.length === 1 ? '' : 's'} selected</span>
                      <strong>Est. total {formatCurrency(selectedTotal)} — pay at lab</strong>
                    </div>
                    <button type="submit" className="patient-btn" disabled={bookingLoading || selectedList.length === 0}>
                      {bookingLoading ? 'Sending inquiry…' : 'Send Booking Inquiry'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {tab === 'mine' && (
            fetchingInquiries ? (
              <div className="patient-empty-state">
                <Clock size={28} className="spin" />
                <p>Loading your bookings…</p>
              </div>
            ) : inquiries.length === 0 ? (
              <div className="patient-empty-state">
                <ClipboardList size={32} />
                <p>No bookings yet.</p>
                <button type="button" className="patient-btn patient-btn-narrow" onClick={() => openTab('book')}>
                  <Plus size={15} /> Book a Test
                </button>
              </div>
            ) : (
              <div className="patient-reports-list patient-bookings-list">
                {inquiries.map((inq) => (
                  <div key={inq._id} className="patient-report-card">
                    <div className="patient-report-info">
                      <div className="patient-report-header-line">
                        <span className="patient-report-name">
                          {(inq.items || []).map((it) => it.name).join(', ') || 'Booking inquiry'}
                        </span>
                        <span
                          className="patient-report-badge"
                          style={{ background: '#f1f5f9', color: INQUIRY_STATUS_STYLE[inq.status] || '#334155' }}
                        >
                          {inq.status}
                        </span>
                      </div>
                      <div className="patient-report-meta-grid">
                        <div className="meta-item">
                          <User size={13} />
                          <span>For: <strong>{inq.name}</strong></span>
                        </div>
                        {inq.preferredDate && (
                          <div className="meta-item">
                            <Calendar size={13} />
                            <span>Preferred: <strong>{formatDate(inq.preferredDate)}</strong></span>
                          </div>
                        )}
                        <div className="meta-item">
                          <FileText size={13} />
                          <span>Est. total: <strong>{formatCurrency((inq.items || []).reduce((s, it) => s + (Number(it.price) || 0), 0))}</strong></span>
                        </div>
                        <div className="meta-item">
                          <Clock size={13} />
                          <span>Raised: <strong>{formatDate(inq.createdAt)}</strong></span>
                        </div>
                      </div>
                      {inq.note && <p className="patient-muted">Note: {inq.note}</p>}
                      <p className="patient-muted">The lab will confirm by phone/SMS. Please pay at the lab counter.</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
        </div>
      )}

      </div>
      {step !== 3 && <div className="patient-signin-help"><span><Phone size={17} /> Need a hand?</span><a href={LAB_PHONE_LINK}>Talk to the lab <ArrowRight size={14} /></a><Link to="/#tests">Browse tests & prices</Link></div>}
      </main>
      <PublicFooter />
      {selectedReport && (
        <div className="patient-modal-backdrop" onClick={() => setSelectedReport(null)}>
          <div ref={reportDialogRef} className="patient-modal-content" role="dialog" aria-modal="true" aria-labelledby="patient-report-dialog-title" onClick={(e) => e.stopPropagation()}>
            <div className="patient-modal-header">
              <div>
                <h3 id="patient-report-dialog-title" className="patient-modal-title">{selectedReport.testName}</h3>
                <span className="patient-modal-subtitle">
                  {selectedReport.type} Report • {formatDate(selectedReport.date)}
                </span>
              </div>
              <button
                type="button"
                className="patient-modal-close"
                onClick={() => setSelectedReport(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="patient-modal-body">
              <div className="report-summary-box">
                <div className="summary-row">
                  <span>Patient Name:</span>
                  <strong>{selectedReport.patientName}</strong>
                </div>
                <div className="summary-row">
                  <span>Registration No:</span>
                  <strong>{selectedReport.registrationNumber}</strong>
                </div>
                {selectedReport.doctorName && (
                  <div className="summary-row">
                    <span>Referring Doctor:</span>
                    <strong>{selectedReport.doctorName}</strong>
                  </div>
                )}
                <div className="summary-row">
                  <span>Status:</span>
                  <span className="badge-available">{selectedReport.status}</span>
                </div>
              </div>

              {selectedReport.resultValue && (
                <div className="report-observation-section">
                  <h4 className="section-subtitle">Laboratory Test Results</h4>
                  <table className="patient-results-table">
                    <thead>
                      <tr>
                        <th>Investigation</th>
                        <th>Observed Value</th>
                        <th>Standard Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>{selectedReport.testName}</strong></td>
                        <td className="highlight-value">
                          {selectedReport.resultValue} {selectedReport.unit}
                        </td>
                        <td>{selectedReport.referenceRange || 'Standard Range'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {selectedReport.findings && (
                <div className="report-observation-section">
                  <h4 className="section-subtitle">Diagnostic Observations / Findings</h4>
                  <div className="findings-text-box">{selectedReport.findings}</div>
                </div>
              )}

              {selectedReport.impression && (
                <div className="report-observation-section">
                  <h4 className="section-subtitle">Diagnostic Impression</h4>
                  <div className="impression-text-box">{selectedReport.impression}</div>
                </div>
              )}

              {selectedReport.interpretation && (
                <div className="report-observation-section">
                  <h4 className="section-subtitle">Clinical Interpretation</h4>
                  <p className="interpretation-text">{selectedReport.interpretation}</p>
                </div>
              )}

              <div className="patient-modal-footer">
                {showGoogleReview && (
                  <div className="patient-google-review" role="note">
                    <div className="patient-google-review-copy">
                      <strong>How was your experience?</strong>
                      <span>Your feedback helps us improve.</span>
                    </div>
                    {googleReviewUrl ? (
                      <a
                        className="patient-google-review-link"
                        href={googleReviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Review us on Google (opens in a new tab)"
                      >
                        <ExternalLink size={15} aria-hidden="true" />
                        <span>Review us on Google</span>
                        <small>Opens in a new tab</small>
                      </a>
                    ) : (
                      <span className="patient-google-review-unavailable">
                        Google review is currently unavailable.
                      </span>
                    )}
                  </div>
                )}

                {selectedReport.downloadable !== false ? (
                  <button
                    type="button"
                    className="patient-download-btn modal-download-btn"
                    data-testid="report-pdf-download"
                    onClick={() => handleDownload(selectedReport)}
                    disabled={downloadingId !== null}
                  >
                    <Download size={16} />
                    <span>{downloadingId === selectedReport.id ? 'Downloading…' : 'Download PDF'}</span>
                  </button>
                ) : (
                  <p className="patient-report-pending-note" role="status">
                    Your report is {selectedReport.status || 'Processing'}. The PDF will be available once the lab completes it.
                  </p>
                )}
                {downloadError && <p role="alert" className="patient-alert-error">{downloadError}</p>}
                {pdfNotice && (
                  <p role="status" data-testid="report-pdf-started">{pdfNotice}</p>
                )}
                <button
                  type="button"
                  className="patient-close-btn"
                  onClick={() => setSelectedReport(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientReportPortal;
