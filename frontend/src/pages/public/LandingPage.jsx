import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Lock,
  ArrowRight,
  Microscope,
  Activity,
  Stethoscope,
  Radio,
  Layers,
  Clock,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Menu,
  X
} from 'lucide-react';
import {
  LAB_PROFILE,
  LAB_SERVICES,
  QUALITY_STANDARDS
} from '../../constants/landingContent';
import './LandingPage.css';

const ICON_MAP = {
  pathology: Microscope,
  biochemistry: Activity,
  usg: Stethoscope,
  xray: Radio,
  packages: Layers
};

const LandingPage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-container">
      {/* Public Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-brand">
            <img src="/logo.jpg" alt="Pure Path Lab" className="landing-logo" />
            <div className="landing-brand-text">
              <span className="landing-brand-title">{LAB_PROFILE.name}</span>
              <span className="landing-brand-tagline">{LAB_PROFILE.tagline}</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="landing-nav-links">
            <button type="button" onClick={() => scrollToSection('home')} className="nav-link-btn">
              Home
            </button>
            <button type="button" onClick={() => scrollToSection('services')} className="nav-link-btn">
              Services
            </button>
            <button type="button" onClick={() => scrollToSection('about')} className="nav-link-btn">
              About
            </button>
            <button type="button" onClick={() => scrollToSection('contact')} className="nav-link-btn">
              Contact
            </button>
          </nav>

          {/* Header Action Buttons */}
          <div className="landing-nav-actions">
            <Link to="/patient/report" className="landing-btn-secondary">
              <FileText size={15} />
              <span>View Your Report</span>
            </Link>
            <Link to="/admin/login" className="landing-btn-primary">
              <Lock size={14} />
              <span>Admin Login</span>
            </Link>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="landing-hamburger-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="landing-mobile-menu">
            <button type="button" onClick={() => scrollToSection('home')} className="mobile-nav-item">
              Home
            </button>
            <button type="button" onClick={() => scrollToSection('services')} className="mobile-nav-item">
              Services
            </button>
            <button type="button" onClick={() => scrollToSection('about')} className="mobile-nav-item">
              About Lab
            </button>
            <button type="button" onClick={() => scrollToSection('contact')} className="mobile-nav-item">
              Contact & Hours
            </button>
            <div className="mobile-menu-actions">
              <Link to="/patient/report" className="landing-btn-secondary mobile-action-btn" onClick={() => setMobileMenuOpen(false)}>
                <FileText size={16} />
                <span>View Your Report</span>
              </Link>
              <Link to="/admin/login" className="landing-btn-primary mobile-action-btn" onClick={() => setMobileMenuOpen(false)}>
                <Lock size={15} />
                <span>Staff Sign In</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section id="home" className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-content">
            <div className="landing-hero-badge">
              <ShieldCheck size={14} />
              <span>Clinical Diagnostic Excellence</span>
            </div>
            <h1 className="landing-hero-title">
              Trusted Diagnostic &amp;<br />
              <span className="landing-highlight">Pathology Services</span>
            </h1>
            <p className="landing-hero-desc">
              {LAB_PROFILE.subtitle}
            </p>

            <div className="landing-hero-cta-group">
              <Link to="/patient/report" className="hero-primary-cta">
                <FileText size={18} />
                <span>View Your Report</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/admin/login" className="hero-secondary-cta">
                <Lock size={16} />
                <span>Admin Login</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dedicated Patient Report Access Section */}
      <section className="landing-patient-section">
        <div className="landing-section-inner">
          <div className="patient-report-banner">
            <div className="patient-banner-left">
              <div className="patient-banner-icon">
                <FileText size={28} />
              </div>
              <div>
                <h2 className="patient-banner-title">Access Your Report</h2>
                <p className="patient-banner-desc">
                  Enter your registered mobile number to securely access your laboratory reports.
                </p>
              </div>
            </div>
            <div className="patient-banner-right">
              <Link to="/patient/report" className="patient-banner-btn">
                <span>View Your Report</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="landing-services-section">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-eyebrow">SERVICES</span>
            <h2 className="landing-section-title">Diagnostic &amp; Pathology Capabilities</h2>
            <p className="landing-section-subtitle">
              Standardized laboratory investigations operated by certified technicians and pathologists.
            </p>
          </div>

          <div className="landing-services-grid">
            {LAB_SERVICES.map((svc) => {
              const Icon = ICON_MAP[svc.id] || Microscope;
              return (
                <div key={svc.id} className="landing-service-card">
                  <div className="service-icon-wrapper">
                    <Icon size={24} />
                  </div>
                  <h3 className="service-title">{svc.title}</h3>
                  <p className="service-desc">{svc.shortDesc}</p>
                  <ul className="service-feature-list">
                    {svc.features.map((f, i) => (
                      <li key={i}>
                        <CheckCircle2 size={14} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About & Quality Standards Section */}
      <section id="about" className="landing-about-section">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-eyebrow">QUALITY &amp; PRECISION</span>
            <h2 className="landing-section-title">Professional Laboratory Standards</h2>
            <p className="landing-section-subtitle">
              Ensuring rigorous testing protocols and transparent electronic report management.
            </p>
          </div>

          <div className="landing-about-grid">
            {QUALITY_STANDARDS.map((std, idx) => (
              <div key={idx} className="landing-about-card">
                <div className="about-card-number">0{idx + 1}</div>
                <h3 className="about-card-title">{std.title}</h3>
                <p className="about-card-desc">{std.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact & Footer Section */}
      <footer id="contact" className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-grid">
            <div className="landing-footer-col">
              <div className="landing-brand footer-brand">
                <img src="/logo.jpg" alt="Pure Path Lab" className="landing-logo" />
                <div className="landing-brand-text">
                  <span className="landing-brand-title">{LAB_PROFILE.name}</span>
                  <span className="landing-brand-tagline">{LAB_PROFILE.tagline}</span>
                </div>
              </div>
              <p className="landing-footer-about">
                Diagnostic pathology, clinical biochemistry, ultrasonography, and digital radiography services with high clinical precision.
              </p>
            </div>

            <div className="landing-footer-col">
              <h4 className="footer-col-title">Operating Schedule</h4>
              <ul className="footer-info-list">
                <li>
                  <Clock size={16} />
                  <span><strong>Mon - Sat:</strong> {LAB_PROFILE.operatingHours.weekdays}</span>
                </li>
                <li>
                  <Clock size={16} />
                  <span><strong>Sunday:</strong> {LAB_PROFILE.operatingHours.sunday}</span>
                </li>
                <li>
                  <Activity size={16} />
                  <span>{LAB_PROFILE.operatingHours.sampleCollection}</span>
                </li>
              </ul>
            </div>

            <div className="landing-footer-col">
              <h4 className="footer-col-title">Laboratory Location</h4>
              <ul className="footer-info-list">
                <li>
                  <MapPin size={16} />
                  <span>{LAB_PROFILE.address}</span>
                </li>
                <li>
                  <Phone size={16} />
                  <span>{LAB_PROFILE.phone}</span>
                </li>
                <li>
                  <Mail size={16} />
                  <span>{LAB_PROFILE.email}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <p>© {new Date().getFullYear()} {LAB_PROFILE.name}. All diagnostic rights reserved.</p>
            <div className="landing-footer-links">
              <Link to="/patient/report">Patient Report Portal</Link>
              <span>•</span>
              <Link to="/admin/login">Staff Login</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
