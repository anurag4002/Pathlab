import React, { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Users, Send, ListChecks, ShieldAlert, X } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { getReferrerProfile } from '../../services/referrerService';
import { applyUiVersion } from '../../utils/uiVersion';
import UiVersionSwitch from '../../components/layout/UiVersionSwitch';
import { ROLE_LABELS } from '../../constants/userConstants';
import '../../components/layout/Header.css';
import './referrer.css';

const NAV = [
  { to: '/referrer', label: 'My patients', icon: Users, end: true },
  { to: '/referrer/send', label: 'Send a patient', icon: Send },
  { to: '/referrer/requests', label: 'My requests', icon: ListChecks }
];

// Referring doctor's own frame: no staff sidebar, three pages, works on a phone.
export default function ReferrerLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [denied, setDenied] = useState(location.state?.denied || '');

  useEffect(() => { applyUiVersion(); }, []);
  useEffect(() => {
    let cancelled = false;
    getReferrerProfile().then((r) => { if (!cancelled && r?.success) setProfile(r.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // A staff link opened by the doctor: say why they landed here, once.
  useEffect(() => {
    if (location.state?.denied) {
      setDenied(location.state.denied);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };
  const doctorName = profile?.doctors?.[0]?.name || user?.name || '';

  return (
    <div className="rf-shell">
      <header className="rf-header">
        <div className="rf-header-inner">
          <div className="rf-brand">
            <span className="rf-lab">{profile?.labName || 'Lab'}</span>
            <span className="rf-who">{[doctorName, ROLE_LABELS.Referrer].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="rf-header-actions">
            <UiVersionSwitch />
            <button type="button" className="rf-signout" onClick={signOut}>
              <LogOut size={16} aria-hidden="true" /><span>Sign out</span>
            </button>
          </div>
        </div>
        <nav className="rf-nav" aria-label="Doctor pages">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `rf-nav-link${isActive ? ' is-active' : ''}`}>
              <Icon size={16} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="rf-main">
        {denied && (
          <div className="rf-notice" role="alert" data-testid="referrer-denied">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>That page is for lab staff only. Here are your patients.</span>
            <button type="button" aria-label="Close" onClick={() => setDenied('')}><X size={16} /></button>
          </div>
        )}
        <Suspense fallback={<div className="route-loading" role="status" aria-label="Loading" />}>
          <Outlet context={{ profile }} />
        </Suspense>
      </main>
    </div>
  );
}
