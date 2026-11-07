import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FileText, MapPin, Menu, Phone, X } from 'lucide-react';
import useLabInfo from './useLabInfo';
import '../../../pages/public/v2/site.css';

// Header, footer and the phone action bar of the public website.
export function SiteLogo({ info }) {
  return (
    <Link to="/" className="pps-logo" aria-label={`${info.labName} home`}>
      <img src="/logo.jpg" alt="" width="36" height="36" />
      <span><b>{info.labName}</b><small>Pathology · imaging · Gonda</small></span>
    </Link>
  );
}

export function SiteHeader() {
  const info = useLabInfo();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);
  const links = [
    { to: '/#prices', label: 'Tests & prices' },
    { to: '/#visit', label: 'How a visit works' },
    { to: '/#find-us', label: 'Find us' },
  ];
  return (
    <>
      <a className="pps-skip" href="#site-main">Skip to content</a>
      <div className="pps-capline" aria-hidden="true" />
      <header className="pps-header">
        <div className="pps-wrap pps-header-row">
          <SiteLogo info={info} />
          <nav className={`pps-nav${open ? ' is-open' : ''}`} aria-label="Main">
            {links.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)}>{l.label}</Link>)}
            <a href={info.telLink} className="pps-nav-call"><Phone size={15} aria-hidden="true" /> {info.phoneDisplay}</a>
          </nav>
          <div className="pps-header-actions">
            <NavLink to="/patient/report" className="pps-btn pps-btn-dark pps-btn-sm"><FileText size={15} aria-hidden="true" /> My reports</NavLink>
            <button type="button" className="pps-menu-btn" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  const info = useLabInfo();
  return (
    <footer className="pps-footer">
      <div className="pps-wrap pps-footer-grid">
        <div>
          <SiteLogo info={info} />
          <p className="pps-footer-note">Tests, scans and reports for families in Gonda. Every report is checked and signed before it reaches you.</p>
        </div>
        <div>
          <h2>Patients</h2>
          <Link to="/patient/report">My reports</Link>
          <Link to="/patient/report?tab=book">Book a test</Link>
          <Link to="/#prices">Tests & prices</Link>
        </div>
        <div>
          <h2>The lab</h2>
          {info.address && <p><MapPin size={15} aria-hidden="true" /> {info.address}</p>}
          <a href={info.telLink}><Phone size={15} aria-hidden="true" /> {info.phoneDisplay}</a>
          {info.email && <a href={`mailto:${info.email}`}>{info.email}</a>}
        </div>
      </div>
      <div className="pps-wrap pps-footer-bottom">
        <span>© {new Date().getFullYear()} {info.labName}</span>
        <Link to="/admin/login">Staff sign-in</Link>
      </div>
    </footer>
  );
}

/** Phones: the two things people come for, always one tap away. */
export function SiteActionBar() {
  const info = useLabInfo();
  return (
    <div className="pps-actionbar" role="navigation" aria-label="Quick actions">
      <a href={info.telLink} className="pps-btn pps-btn-light"><Phone size={17} aria-hidden="true" /> Call</a>
      <Link to="/patient/report" className="pps-btn pps-btn-blue"><FileText size={17} aria-hidden="true" /> My reports</Link>
    </div>
  );
}
