import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, AlertCircle, CheckCircle2, X } from 'lucide-react';
import useAuth from '../../../hooks/useAuth';
import apiClient from '../../../services/apiClient';
import { Button } from '../../../components/common';
import '../Login.css';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your registered email/phone and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      if (res.success) {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      if (!err.response) {
        setError('Unable to reach the backend server. Please verify the backend server is running on port 5001.');
      } else {
        setError(err.response?.data?.message || 'Invalid email/phone or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthClick = async (provider) => {
    setError('');
    try {
      const res = await apiClient.get(`/auth/${provider}/url`);
      if (res.data?.data?.url) {
        window.location.href = res.data.data.url;
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        `${provider.toUpperCase()} login is not configured on the server. Please provide OAuth API credentials in backend/.env.`;
      setError(errorMsg);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotInput.trim()) {
      setForgotError('Please enter your registered email or phone number.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    setForgotMsg('');
    try {
      const res = await apiClient.post('/auth/forgot-password', { email: forgotInput });
      setForgotMsg(res.data?.message || 'Password reset request submitted.');
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Failed to submit password reset request.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-top-nav">
          <Link to="/" className="login-back-link">
            <ArrowLeft size={15} />
            <span>Pure Path Lab Home</span>
          </Link>
        </div>

        <div className="login-header">
          <img src="/logo.jpg" alt="Pure Path Lab" className="login-logo-img" />
          <h1 className="login-title">PURE PATH LAB</h1>
          <p className="login-subtitle">Laboratory Management System</p>
        </div>

        {error && (
          <div className="login-error-alert" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field-group">
            <label htmlFor="login-email" className="login-field-label">Email or Phone</label>
            <input
              id="login-email"
              type="text"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email or phone"
              required
              autoComplete="username"
            />
          </div>

          <div className="login-field-group">
            <label htmlFor="login-password" className="login-field-label">Password</label>
            <div className="login-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            block
            className="login-submit-btn"
          >
            Sign In
          </Button>

          <div className="login-divider">
            <span>or continue with</span>
          </div>

          <div className="login-oauth-grid">
            <button
              type="button"
              className="login-oauth-btn google-oauth-btn"
              onClick={() => handleOAuthClick('google')}
            >
              <GoogleIcon />
              <span>Google</span>
            </button>
            <button
              type="button"
              className="login-oauth-btn facebook-oauth-btn"
              onClick={() => handleOAuthClick('facebook')}
            >
              <FacebookIcon />
              <span>Facebook</span>
            </button>
          </div>

          <div className="login-forgot-wrapper">
            <button
              type="button"
              className="login-forgot-link"
              onClick={() => {
                setForgotModalOpen(true);
                setForgotMsg('');
                setForgotError('');
                setForgotInput(email);
              }}
            >
              Forgot password?
            </button>
          </div>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="login-modal-backdrop" onClick={() => setForgotModalOpen(false)}>
          <div className="login-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal-header">
              <h3 className="login-modal-title">Password Recovery</h3>
              <button
                type="button"
                className="login-modal-close"
                onClick={() => setForgotModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="login-modal-body">
              <p className="login-modal-desc">
                Enter your registered staff email or phone number to request password recovery.
              </p>

              {forgotError && (
                <div className="login-error-alert" role="alert">
                  <AlertCircle size={15} />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotMsg ? (
                <div className="login-success-alert">
                  <CheckCircle2 size={16} />
                  <span>{forgotMsg}</span>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="login-form">
                  <div className="login-field-group">
                    <label htmlFor="forgot-email" className="login-field-label">Staff Email or Phone</label>
                    <input
                      id="forgot-email"
                      type="text"
                      className="login-input"
                      value={forgotInput}
                      onChange={(e) => setForgotInput(e.target.value)}
                      placeholder="Enter registered email or phone"
                      required
                      autoFocus
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    loading={forgotLoading}
                    block
                  >
                    Send Recovery Request
                  </Button>
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
