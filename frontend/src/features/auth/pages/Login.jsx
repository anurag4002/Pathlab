import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, AlertCircle, CheckCircle2, X } from 'lucide-react';
import useAuth from '../../../hooks/useAuth';
import apiClient from '../../../services/apiClient';
import { requestEmailOtp, verifyEmailOtp, requestPasswordReset, resetPassword } from '../../../services/authService';
import { Button } from '../../../components/common';
import '../Login.css';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('password'); // password | otp
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [remember, setRemember] = useState(false);
  const [browserCode, setBrowserCode] = useState(() => localStorage.getItem('ppl_browser') || '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fp, setFp] = useState({ email: '', otp: '', newPassword: '', step: 1 });
  const [fpMsg, setFpMsg] = useState('');
  const [fpErr, setFpErr] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/dashboard', { replace: true }); }, [isAuthenticated, navigate]);

  const persistBrowser = (code) => { if (code?.trim()) localStorage.setItem('ppl_browser', code.trim()); };
  const opts = () => ({ remember, browserCode: browserCode.trim() });

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Please enter both email/phone and password.'); return; }
    setLoading(true); setError(''); setInfo('');
    try {
      persistBrowser(browserCode);
      const res = await login(email.trim(), password, opts());
      if (res.success) navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(!err.response ? 'Unable to reach backend (port 5001).' : err.response?.data?.message || 'Invalid email/phone or password');
    } finally { setLoading(false); }
  };

  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    if (!email.trim()) { setError('Enter your email first.'); return; }
    setLoading(true); setError(''); setInfo('');
    try { const r = await requestEmailOtp(email.trim()); setOtpSent(true); setInfo(r.message || 'OTP sent to email.'); }
    catch (err) { setError(err.response?.data?.message || 'Failed to send OTP.'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!email.trim() || !otp.trim()) { setError('Enter email and OTP.'); return; }
    setLoading(true); setError('');
    try {
      persistBrowser(browserCode);
      const r = await verifyEmailOtp(email.trim(), otp.trim(), opts());
      if (r.success) { setInfo(r.message || 'Logged in.'); navigate('/dashboard', { replace: true }); }
    } catch (err) { setError(err.response?.data?.message || 'Invalid OTP.'); }
    finally { setLoading(false); }
  };

  const handleOAuth = async (p) => {
    setError('');
    try { const r = await apiClient.get(`/auth/${p}/url`); if (r.data?.data?.url) window.location.href = r.data.data.url; }
    catch (err) { setError(err.response?.data?.message || `${p} login not configured.`); }
  };

  const handleFpStep1 = async (e) => {
    e.preventDefault();
    if (!fp.email.trim()) { setFpErr('Enter registered email.'); return; }
    setFpLoading(true); setFpErr(''); setFpMsg('');
    try { const r = await requestPasswordReset(fp.email.trim()); setFpMsg(r.message || 'OTP sent.'); setFp(s => ({ ...s, step: 2 })); }
    catch (err) { setFpErr(err.response?.data?.message || 'Failed to request reset.'); }
    finally { setFpLoading(false); }
  };
  const handleFpStep2 = async (e) => {
    e.preventDefault();
    if (!fp.otp.trim() || !fp.newPassword) { setFpErr('Enter OTP and new password.'); return; }
    setFpLoading(true); setFpErr('');
    try { const r = await resetPassword(fp.email.trim(), fp.otp.trim(), fp.newPassword); setFpMsg(r.message || 'Password reset. Please login.'); setFp(s => ({ ...s, step: 1, otp: '', newPassword: '' })); }
    catch (err) { setFpErr(err.response?.data?.message || 'Reset failed.'); }
    finally { setFpLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-top-nav"><Link to="/" className="login-back-link"><ArrowLeft size={15} /><span>Pure Path Lab Home</span></Link></div>
        <div className="login-header">
          <img src="/logo.jpg" alt="Pure Path Lab" className="login-logo-img" />
          <h1 className="login-title">PURE PATH LAB</h1>
          <p className="login-subtitle">Laboratory Management System</p>
        </div>
        {error && <div className="login-error-alert" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
        {info && <div className="login-success-alert"><CheckCircle2 size={16} /><span>{info}</span></div>}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button size="sm" variant={mode === 'password' ? 'primary' : 'secondary'} onClick={() => { setMode('password'); setError(''); }}>Password</Button>
          <Button size="sm" variant={mode === 'otp' ? 'primary' : 'secondary'} onClick={() => { setMode('otp'); setError(''); }}>Login with Email OTP</Button>
        </div>
        {mode === 'password' ? (
          <form onSubmit={handlePasswordLogin} className="login-form">
            <div className="login-field-group"><label className="login-field-label" htmlFor="login-email">Email or Phone</label>
              <input id="login-email" className="login-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email or phone" required autoComplete="username" /></div>
            <div className="login-field-group"><label className="login-field-label" htmlFor="login-password">Password</label>
              <div className="login-password-wrapper">
                <input id="login-password" type={showPassword ? 'text' : 'password'} className="login-input login-password-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
                <button type="button" className="login-password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div></div>
            <div className="login-field-group"><label className="login-field-label" htmlFor="browser-code">Browser Code (optional)</label>
              <input id="browser-code" className="login-input" value={browserCode} onChange={(e) => setBrowserCode(e.target.value)} placeholder="e.g. FRONT-DESK-01" autoComplete="off" /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.85rem' }}><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
            <Button type="submit" variant="primary" loading={loading} block className="login-submit-btn">Sign In</Button>
          </form>
        ) : (
          <form onSubmit={otpSent ? handleVerifyOtp : handleRequestOtp} className="login-form">
            <div className="login-field-group"><label className="login-field-label">Email</label>
              <input className="login-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email" required /></div>
            {otpSent && <div className="login-field-group"><label className="login-field-label">OTP</label>
              <input className="login-input" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" required /></div>}
            <div className="login-field-group"><label className="login-field-label">Browser Code (optional)</label>
              <input className="login-input" value={browserCode} onChange={(e) => setBrowserCode(e.target.value)} placeholder="e.g. FRONT-DESK-01" /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.85rem' }}><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
            {!otpSent
              ? <Button type="submit" variant="primary" loading={loading} block>Send OTP</Button>
              : <><Button type="submit" variant="primary" loading={loading} block>Verify & Sign In</Button>
                <Button variant="ghost" size="sm" onClick={() => setOtpSent(false)}>Resend OTP</Button></>}
          </form>
        )}
        <div className="login-divider"><span>or continue with</span></div>
        <div className="login-oauth-grid">
          <button type="button" className="login-oauth-btn" onClick={() => handleOAuth('google')}><GoogleIcon /><span>Google</span></button>
          <button type="button" className="login-oauth-btn" onClick={() => handleOAuth('facebook')}><FacebookIcon /><span>Facebook</span></button>
        </div>
        <div className="login-forgot-wrapper"><button type="button" className="login-forgot-link" onClick={() => { setForgotOpen(true); setFpMsg(''); setFpErr(''); setFp(s => ({ ...s, email, step: 1 })); }}>Forgot password?</button></div>
      </div>
      {forgotOpen && (
        <div className="login-modal-backdrop" onClick={() => setForgotOpen(false)}>
          <div className="login-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-header"><h3 className="login-modal-title">Password Recovery (2-step)</h3>
              <button type="button" className="login-modal-close" onClick={() => setForgotOpen(false)}><X size={18} /></button></div>
            <div className="login-modal-body">
              {fpErr && <div className="login-error-alert"><AlertCircle size={15} /><span>{fpErr}</span></div>}
              {fpMsg && <div className="login-success-alert"><CheckCircle2 size={16} /><span>{fpMsg}</span></div>}
              {fp.step === 1 ? (
                <form onSubmit={handleFpStep1} className="login-form">
                  <div className="login-field-group"><label className="login-field-label">Email</label>
                    <input className="login-input" value={fp.email} onChange={(e) => setFp(s => ({ ...s, email: e.target.value }))} placeholder="Registered email" required autoFocus /></div>
                  <Button type="submit" variant="primary" loading={fpLoading} block>Send OTP</Button>
                </form>
              ) : (
                <form onSubmit={handleFpStep2} className="login-form">
                  <div className="login-field-group"><label className="login-field-label">OTP</label>
                    <input className="login-input" value={fp.otp} onChange={(e) => setFp(s => ({ ...s, otp: e.target.value }))} required /></div>
                  <div className="login-field-group"><label className="login-field-label">New Password</label>
                    <input type="password" className="login-input" value={fp.newPassword} onChange={(e) => setFp(s => ({ ...s, newPassword: e.target.value }))} required /></div>
                  <Button type="submit" variant="primary" loading={fpLoading} block>Reset Password</Button>
                  <Button variant="ghost" size="sm" onClick={() => setFp(s => ({ ...s, step: 1 }))}>Back</Button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Login;
