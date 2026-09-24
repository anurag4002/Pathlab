import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Eye,
  X,
  Lock,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Calendar,
  Building,
  ClipboardList,
  Plus,
  CalendarPlus
} from 'lucide-react';
import {
  requestOtp,
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
import './PatientPortal.css';

const INQUIRY_STATUS_STYLE = {
  New: '#1d4ed8',
  Contacted: '#b06000',
  Confirmed: '#137333',
  Cancelled: '#5f6368'
};

const PatientReportPortal = () => {
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 2.5: Register, 3: Home
  const [phone, setPhone] = useState('');
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
  const [tab, setTab] = useState('reports'); // reports | book | mine
  const [reports, setReports] = useState([]);
  const [fetchingReports, setFetchingReports] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [selectedReport, setSelectedReport] = useState(null);

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
    try {
      const res = await getPatientReports();
      if (res.success) {
        setReports(res.data);
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

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const res = await getBookingCatalog();
      if (res.success) setCatalog(res.data || { tests: [], packages: [] });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load bookable tests.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const openTab = (t) => {
    setTab(t);
    setError('');
    setBookingDone('');
    if (t === 'book' && catalog.tests.length === 0 && catalog.packages.length === 0) loadCatalog();
    if (t === 'mine') loadInquiries();
    if (t === 'reports' && reports.length === 0) loadReports();
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
          setTab('reports');
          loadReports();
          loadInquiries();
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
        setTab('reports');
        loadReports();
        loadInquiries();
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
    try {
      const fileName = `${report.type}_Report_${report.registrationNumber}.pdf`;
      await downloadPatientReport(report.id, fileName);
    } catch {
      alert('Report download failed. Please contact Pure Path Lab support.');
    }
  };

  const handleLogout = () => {
    patientLogout();
    setStep(1);
    setPhone('');
    setDevOtp('');
    setOtp(['', '', '', '', '', '']);
    setReports([]);
    setProfiles([]);
    setIsNewNumber(false);
    setSelectedReport(null);
    setSelected({});
    setInquiries([]);
    setTab('reports');
  };

  return (
    <div className="patient-portal-container">
      <div className="patient-portal-nav">
        <Link to="/" className="patient-back-link">
          <ArrowLeft size={16} />
          <span>Back to Pure Path Lab</span>
        </Link>
        <Link to="/admin/login" className="patient-staff-link">
          <Lock size={14} />
          <span>Staff Login</span>
        </Link>
      </div>

      <div className="patient-portal-header">
        <img src="/logo.jpg" alt="Pure Path Lab" className="patient-portal-logo" />
        <h1 className="patient-portal-title">PURE PATH LAB</h1>
        <p className="patient-portal-subtitle">Patient Diagnostic Report Portal</p>
      </div>

      {step === 1 && (
        <div className="patient-card">
          <div className="patient-card-icon-header">
            <FileText size={24} />
          </div>
          <h2 className="patient-step-title">View Your Report</h2>
          <p className="patient-step-desc">
            Access your laboratory report securely using your mobile number. New here? You can create your profile after OTP verification.
          </p>

          {error && (
            <div className="patient-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRequestOtp} className="patient-form">
            <div className="patient-form-group">
              <label htmlFor="patient-phone" className="patient-form-label">Mobile Number</label>
              <div className="patient-input-prefix">
                <span className="patient-phone-flag">+91</span>
                <input
                  id="patient-phone"
                  type="tel"
                  className="patient-phone-input"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={10}
                  required
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" className="patient-btn" disabled={loading}>
              {loading ? 'Requesting OTP...' : 'Get OTP'}
            </button>
          </form>

          <div className="patient-security-note">
            <Lock size={13} />
            <span>End-to-end encrypted medical report access</span>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="patient-card">
          <div className="patient-card-icon-header">
            <Lock size={24} />
          </div>
          <h2 className="patient-step-title">Enter Verification Code</h2>
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
              <strong className="patient-dev-otp-code">{devOtp}</strong>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="patient-form">
            <div className="otp-digit-container">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-input-${idx}`}
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
            <button type="button" className="patient-link-btn" onClick={() => { setStep(1); setDevOtp(''); }}>
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
          <h2 className="patient-step-title">Create Your Profile</h2>
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
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="patient-card patient-card-wide">
          <div className="patient-portal-topbar">
            <div>
              <h2 className="patient-welcome-text">
                {profiles[0]?.name ? `Hello, ${profiles[0].name}` : 'Your Diagnostic Reports'}
              </h2>
              <div className="patient-phone-badge">Registered Mobile: +91 {phone}</div>
            </div>
            <button type="button" className="patient-logout-btn" onClick={handleLogout}>
              Sign Out
            </button>
          </div>

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

          {tab === 'reports' && (
            fetchingReports ? (
              <div className="patient-empty-state">
                <Clock size={28} className="spin" />
                <p>Fetching your verified reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="patient-empty-state">
                <FileText size={32} />
                <p>No reports currently found for this mobile number.</p>
                <small>If you recently gave a sample, please check back in a few hours — or book your first test below.</small>
                <button type="button" className="patient-btn patient-btn-narrow" onClick={() => openTab('book')}>
                  <Plus size={15} /> Book a Test
                </button>
              </div>
            ) : (
              <div className="patient-reports-list">
                {reports.map((report) => (
                  <div key={report.id} className="patient-report-card">
                    <div className="patient-report-info">
                      <div className="patient-report-header-line">
                        <span className="patient-report-name">{report.testName}</span>
                        <span className={`patient-report-badge badge-${report.status.toLowerCase()}`}>
                          {report.status}
                        </span>
                      </div>

                      <div className="patient-report-meta-grid">
                        <div className="meta-item">
                          <User size={13} />
                          <span>Patient: <strong>{report.patientName}</strong></span>
                        </div>
                        <div className="meta-item">
                          <Building size={13} />
                          <span>Reg No: <strong>{report.registrationNumber}</strong></span>
                        </div>
                        <div className="meta-item">
                          <Calendar size={13} />
                          <span>Date: <strong>{formatDate(report.date)}</strong></span>
                        </div>
                        <div className="meta-item">
                          <FileText size={13} />
                          <span>Department: <strong>{report.type}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="patient-report-actions">
                      <button
                        type="button"
                        className="patient-view-btn"
                        onClick={() => setSelectedReport(report)}
                      >
                        <Eye size={15} />
                        <span>View Report</span>
                      </button>
                      {report.hasFile && (
                        <button
                          type="button"
                          className="patient-download-btn"
                          onClick={() => handleDownload(report)}
                        >
                          <Download size={15} />
                          <span>Download PDF</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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
                <form onSubmit={handleBook}>
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

                  <div className="patient-book-foot">
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
              <div className="patient-reports-list">
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
      )}

      {/* Report Quick View Modal */}
      {selectedReport && (
        <div className="patient-modal-backdrop" onClick={() => setSelectedReport(null)}>
          <div className="patient-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="patient-modal-header">
              <div>
                <h3 className="patient-modal-title">{selectedReport.testName}</h3>
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
                {selectedReport.hasFile && (
                  <button
                    type="button"
                    className="patient-download-btn modal-download-btn"
                    onClick={() => handleDownload(selectedReport)}
                  >
                    <Download size={16} />
                    <span>Download Official Signed PDF</span>
                  </button>
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
