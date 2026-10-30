import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import { LAB_PROFILE } from '../../constants/landingContent';
import './PublicLayout.css';

export const LAB_PHONE_LINK = `tel:${LAB_PROFILE.phone.replace(/[^+\d]/g, '')}`;

export function PublicBrand({ inverse = false }) {
  return <Link to="/" className={`public-brand${inverse ? ' public-brand-inverse' : ''}`} aria-label="Pure Path Lab home">
    <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="" width="42" height="42" />
    <span><strong>Pure Path Lab<span className="public-brand-dot">.</span></strong><small>Pathology & diagnostics</small></span>
  </Link>;
}

export function PublicHeader({ active = 'home' }) {
  const [open, setOpen] = useState(false);
  const links = [
    { label: 'Home', to: '/', key: 'home' },
    { label: 'Tests & packages', to: '/#tests', key: 'tests' },
    { label: 'Book a test', to: '/patient/report?tab=book', key: 'book' },
    { label: 'My reports', to: '/patient/report', key: 'reports' }
  ];
  return <>
    <a className="public-skip-link" href="#public-main">Skip to content</a>
    <header className="public-header">
      <div className="public-container public-header-inner">
        <PublicBrand />
        <button className="public-menu-toggle" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(value => !value)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav id="public-navigation" aria-label="Main navigation" className={`public-navigation${open ? ' is-open' : ''}`}>
          {links.map(link => <Link key={link.key} to={link.to} aria-current={active === link.key ? 'page' : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}
          <a href={LAB_PHONE_LINK} className="public-call"><Phone size={15} /> Call the lab</a>
        </nav>
      </div>
    </header>
  </>;
}

export function PublicFooter() {
  return <footer className="public-footer">
    <div className="public-container public-footer-grid">
      <div className="public-footer-about">
        <PublicBrand inverse />
        <p>A simpler way to book your tests, keep track of your visits, and find your reports.</p>
        <a href={LAB_PHONE_LINK}><Phone size={15} /> {LAB_PROFILE.phone}</a>
        <a href={`mailto:${LAB_PROFILE.email}`}><Mail size={15} /> {LAB_PROFILE.email}</a>
      </div>
      <div><h3>For patients</h3><Link to="/#tests">Tests & prices <ArrowUpRight size={14} /></Link><Link to="/patient/report?tab=book">Book a test <ArrowUpRight size={14} /></Link><Link to="/patient/report">View your reports <ArrowUpRight size={14} /></Link><Link to="/#contact">Visit the lab <ArrowUpRight size={14} /></Link></div>
      <div><h3>Visit us</h3><p className="public-footer-detail"><MapPin size={17} /> {LAB_PROFILE.address}</p><p className="public-footer-detail"><Clock3 size={17} /><span>Mon–Sat: {LAB_PROFILE.operatingHours.weekdays}<br />Sun: {LAB_PROFILE.operatingHours.sunday}</span></p></div>
    </div>
    <div className="public-container public-footer-bottom"><span>© {new Date().getFullYear()} Pure Path Lab. All rights reserved.</span><Link to="/login">Staff login <ArrowUpRight size={13} /></Link></div>
  </footer>;
}
