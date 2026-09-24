import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Building,
  ExternalLink
} from 'lucide-react';
import {
  requestOtp,
  verifyOtp,
  getPatientReports,
  downloadPatientReport,
  patientLogout
} from '../../services/patientPortalService';
import formatDate from '../../utils/formatDate';
import './PatientPortal.css';

// The patient contract may expose the existing LabProfile.googleReviewLink
// field. Do not call the staff-only profile/review endpoints from this portal.
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
  if (type === 'pathology') return status === 'completed' || status === 'signed';
  if (type === 'usg' || type === 'digital x-ray') return status === 'completed';
  return false;
};

const PatientReportPortal = () => {
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: Reports
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [fetchingReports, setFetchingReports] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [selectedReport, setSelectedReport] = useState(null);
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');

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

  useEffect(() => {
    const restorePatientSession = async () => {
      const token = sessionStorage.getItem('ppl_patient_token');
      const savedPhone = sessionStorage.getItem('ppl_patient_phone');
      if (token && savedPhone) {
        setPhone(savedPhone);
        setStep(3);
        await loadReports();
      }
    };
    restorePatientSession();
  }, []);

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
      const res = await requestOtp(cleanPhone);
      if (res.success) {
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
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
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
        setStep(3);
        loadReports();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
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
    setOtp(['', '', '', '', '', '']);
    setReports([]);
    setSelectedReport(null);
    setGoogleReviewUrl('');
  };

  const showGoogleReview = isPatientReportReviewEligible(selectedReport);

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
            Access your laboratory report securely using your registered mobile number.
          </p>

          {error && (
            <div className="patient-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRequestOtp} className="patient-form">
            <div className="patient-form-group">
              <label htmlFor="patient-phone" className="patient-form-label">Registered Mobile Number</label>
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
          </p>

          {error && (
            <div className="patient-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
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
                  className="otp-digit-input"
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  maxLength={1}
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
            <button type="button" className="patient-link-btn" onClick={() => setStep(1)}>
              Change Number
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="patient-card patient-card-wide">
          <div className="patient-portal-topbar">
            <div>
              <h2 className="patient-welcome-text">Your Diagnostic Reports</h2>
              <div className="patient-phone-badge">Registered Mobile: +91 {phone}</div>
            </div>
            <button type="button" className="patient-logout-btn" onClick={handleLogout}>
              Sign Out
            </button>
          </div>

          {error && (
            <div className="patient-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {fetchingReports ? (
            <div className="patient-empty-state">
              <Clock size={28} className="spin" />
              <p>Fetching your verified reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="patient-empty-state">
              <FileText size={32} />
              <p>No reports currently found for this mobile number.</p>
              <small>If you recently gave a sample, please check back in a few hours.</small>
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
