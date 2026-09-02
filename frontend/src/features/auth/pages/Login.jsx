import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../hooks/useAuth';
import { Input, Button } from '../../../components/common';
import '../Login.css';

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please fill in both email/phone and password.');
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
      setError(err.response?.data?.message || 'Invalid email/phone or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.jpg" alt="Pure Path Lab" className="login-logo-img" />
          <h1 className="login-title">PURE PATH LAB</h1>
          <p className="login-subtitle">Laboratory Management System</p>
        </div>

        {error && (
          <div className="login-error-alert" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <Input
            label="Email or Phone"
            name="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@purepathlab.com"
            required
            autoComplete="username"
          />

          <Input
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            block
            className="login-submit-btn"
          >
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
