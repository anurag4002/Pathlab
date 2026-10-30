import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, ArrowDown, ArrowRight, ArrowUpRight, CalendarCheck, Check, CheckCheck, ChevronDown, Clock3, FileCheck2, FileText, Layers, MapPin, Microscope, Phone, Radio, Search, ShieldCheck, Smartphone, Users, X } from 'lucide-react';
import { LAB_PROFILE } from '../../constants/landingContent';
import { getTests } from '../../services/testService';
import { getPackages } from '../../services/packageService';
import { LAB_PHONE_LINK, PublicFooter, PublicHeader } from '../../components/public/PublicLayout';
import './LandingPage.css';

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
const activeItems = response => Array.isArray(response?.data) ? response.data.filter(item => !item.isDeleted && item.status !== 'Inactive' && !item.isDerived) : [];
const SERVICES = [
  { icon: Microscope, name: 'Blood & pathology', text: 'Blood counts and routine laboratory investigations.' },
  { icon: Activity, name: 'Biochemistry & hormones', text: 'Blood sugar, thyroid, liver and kidney profiles.' },
  { icon: Radio, name: 'Ultrasound & X-ray', text: 'Explore the imaging services available at the lab.' },
  { icon: Layers, name: 'Health check-up packages', text: 'Related tests together, with clear package pricing.' }
];
const QUESTIONS = [
  ['How do I download my report?', 'Open My reports and sign in using your registered mobile number and birth year. You can also use mobile OTP. Ready reports have a Download PDF button.'],
  ['Can I book a test for a family member?', 'Yes. Sign in to the patient portal, choose Book a Test, and enter the name of the person you are booking for. The lab team will confirm your request.'],
  ['Do I need to pay online?', 'No online payment is needed to send a booking request. The lab team confirms the visit and you pay at the lab.'],
  ['My report says Processing. What should I do?', 'This means your report is not ready to download yet. Check My reports again later, or contact the lab for an update.']
];

function SampleReport() {
  return <div className="home-report-wrap">
    <div className="home-report-decoration" aria-hidden="true"><span /><span /><span /></div>
    <article className="home-sample-report" aria-label="Illustrative sample report, not a patient record">
      <div className="home-report-top"><span><FileText size={15} /> A little clarity, on one page</span><span className="home-sample-badge">Sample report</span></div>
      <div className="home-report-heading"><span className="home-report-icon"><Microscope size={24} /></span><div><small>HAEMATOLOGY</small><h2>Complete Blood Count</h2></div></div>
      <div className="home-report-table-heading"><span>Investigation</span><span>Result</span></div>
      <dl className="home-report-values">
        <div><dt>Haemoglobin</dt><dd>13.8 <span>g/dL</span></dd></div>
        <div><dt>Total leucocyte count</dt><dd>6,800 <span>/cumm</span></dd></div>
        <div><dt>Platelet count</dt><dd>2.45 <span>lakh/cumm</span></dd></div>
        <div><dt>MCV</dt><dd>88.2 <span>fL</span></dd></div>
      </dl>
      <div className="home-report-bottom"><span><ShieldCheck size={15} /> Clear results. A PDF you can keep.</span><span>PDF <ArrowDown size={13} /></span></div>
      <p className="home-sample-disclaimer">For illustration only · not a patient record</p>
    </article>
    <div className="home-report-note"><span><CheckCheck size={17} /></span><div><strong>A simpler report experience</strong><small>On your phone. Whenever you need it.</small></div></div>
  </div>;
}

export default function LandingPage() {
  const { hash } = useLocation();
  const [catalog, setCatalog] = useState({ tests: [], packages: [] });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [kind, setKind] = useState('packages');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(6);
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false);
    Promise.allSettled([getTests({ status: 'Active' }), getPackages()]).then(([tests, packages]) => {
      if (!active) return;
      const testResponse = tests.status === 'fulfilled' && tests.value?.success ? tests.value : null;
      const packageResponse = packages.status === 'fulfilled' && packages.value?.success ? packages.value : null;
      const next = { tests: activeItems(testResponse), packages: activeItems(packageResponse) };
      setCatalog(next); setFailed(!testResponse || !packageResponse);
      if (!next.packages.length && next.tests.length) setKind('tests');
      setLoading(false);
    });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash]);
  const matches = catalog[kind].filter(item => `${item.name} ${item.code || ''} ${item.category?.name || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const changeKind = value => { setKind(value); setQuery(''); setLimit(6); };
  return <div className="public-site home-page">
    <PublicHeader />
    <main id="public-main">
      <section className="home-hero">
        <div className="public-container home-hero-grid">
          <div className="home-hero-copy">
            <span className="home-hero-pill"><span /> YOUR NEIGHBOURHOOD DIAGNOSTIC PARTNER</span>
            <h1>Lab tests, made simple.<br />Your reports,<br />{' '}<span>within reach.</span></h1>
            <p>From booking a test to finding your latest report, everything you need from Pure Path Lab is right here.</p>
            <div className="home-hero-actions"><Link to="/patient/report?tab=book" className="public-button">Book a test <ArrowUpRight size={16} /></Link><Link to="/patient/report" className="public-button public-button-outline"><FileText size={16} /> View my reports</Link></div>
            <div className="home-hero-checks"><span><Check size={15} /> Easy online booking</span><span><Check size={15} /> Secure report access</span><span><Check size={15} /> Care for the whole family</span></div>
          </div>
          <SampleReport />
        </div>
      </section>
      <section className="home-benefits" aria-label="Patient services">
        <div className="public-container home-benefit-grid">{[
          { icon: CalendarCheck, title: 'Plan your visit', text: 'Send a booking request in a few simple steps.' },
          { icon: Smartphone, title: 'Reports on your phone', text: 'View and download your reports in one place.' },
          { icon: Users, title: 'Your family, together', text: 'Book for yourself or someone you care about.' },
          { icon: Phone, title: 'A real person to help', text: 'Contact the lab when you need a little guidance.' }
        ].map(({ icon: Icon, title, text }) => <div className="home-benefit" key={title}><Icon size={23} strokeWidth={1.6} /><div><h2>{title}</h2><p>{text}</p></div></div>)}</div>
      </section>
      <section id="tests" className="home-section home-catalog">
        <div className="public-container">
          <div className="home-section-heading"><div><span className="public-eyebrow">A LITTLE CARE GOES A LONG WAY</span><h2>Find the right test for you.</h2><p>Browse the lab’s tests and packages, with prices up front.</p></div><Link to="/patient/report?tab=book" className="home-text-link">Go to booking <ArrowUpRight size={16} /></Link></div>
          <div className="home-catalog-toolbar"><div className="home-catalog-tabs" role="group" aria-label="Browse catalog"><button type="button" aria-pressed={kind === 'packages'} onClick={() => changeKind('packages')}>Health packages</button><button type="button" aria-pressed={kind === 'tests'} onClick={() => changeKind('tests')}>Tests & prices</button></div><div className="home-catalog-search"><Search size={17} /><input type="search" aria-label="Search tests and packages" placeholder={`Search ${kind === 'tests' ? 'tests' : 'packages'}…`} value={query} onChange={event => { setQuery(event.target.value); setLimit(6); }} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button>}</div></div>
          {failed && <div className="home-catalog-message" role="status">Some prices couldn’t be loaded. <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button> or <a href={LAB_PHONE_LINK}>call the lab</a> for help.</div>}
          {loading ? <div className="home-catalog-loading" role="status">Loading tests and prices…</div> : matches.length ? <>
            <div className="home-package-grid">{matches.slice(0, limit).map(item => <article className="home-package-card" key={item._id}>
              <div className="home-package-tag"><span>{kind === 'packages' ? <Layers size={15} /> : <Microscope size={15} />}</span>{kind === 'packages' ? 'HEALTH PACKAGE' : item.category?.name || 'LABORATORY TEST'}</div>
              <h3>{item.name}</h3>
              <p>{item.description || (kind === 'packages' ? 'A group of related tests, conveniently brought together.' : 'View the price and request a booking with our lab team.')}</p>
              {kind === 'packages' && item.includedTests?.length > 0 && <span className="home-package-count"><Check size={13} /> {item.includedTests.length} tests included</span>}
              <div className="home-package-bottom"><div><small>{kind === 'packages' ? 'Package price' : 'Test price'}</small><strong>{Number.isFinite(Number(item.price)) ? money(item.price) : 'Ask the lab'}</strong></div><Link to={`/patient/report?tab=book&${kind === 'packages' ? 'package' : 'test'}=${encodeURIComponent(item._id)}`} aria-label={`Book ${item.name}`}>Book <ArrowUpRight size={15} /></Link></div>
            </article>)}</div>
            {matches.length > limit && <button className="home-show-more" type="button" onClick={() => setLimit(value => value + 6)}>Show more {kind === 'packages' ? 'packages' : 'tests'} <ChevronDown size={16} /></button>}
          </> : <div className="home-catalog-empty"><Search size={25} /><h3>{query ? 'No matching tests found' : `No ${kind === 'packages' ? 'packages' : 'tests'} listed yet`}</h3><p>{query ? 'Try another test name or code, or call the lab for help.' : 'Our team can help you choose a test and confirm the price.'}</p><a href={LAB_PHONE_LINK} className="home-text-link">Talk to our team <ArrowUpRight size={15} /></a></div>}
          <p className="home-catalog-footnote"><ShieldCheck size={14} /> Prices are from the lab’s current catalog. Booking is a request; the lab team confirms your visit.</p>
        </div>
      </section>
      <section className="home-section home-services"><div className="public-container"><div className="home-section-heading"><div><span className="public-eyebrow">HERE FOR YOUR EVERYDAY HEALTH</span><h2>Care, across the essentials.</h2></div><p>Routine tests, health profiles, and imaging.<br />One familiar place to start.</p></div><div className="home-service-grid">{SERVICES.map(({ icon: Icon, name, text }) => <article key={name}><span><Icon size={23} strokeWidth={1.5} /></span><h3>{name}</h3><p>{text}</p></article>)}</div></div></section>
      <section id="how-it-works" className="home-section home-process"><div className="public-container"><div className="home-section-heading home-heading-centered"><span className="public-eyebrow">FROM BOOKING TO REPORT</span><h2>A few steps. A clearer picture.</h2><p>Less running around. More time for yourself.</p></div><div className="home-process-grid">{[
        ['01', 'Choose your tests', 'Browse the catalog and send a booking request for yourself or a family member.'],
        ['02', 'Visit the lab', 'Our team confirms your request and helps you with your tests and payment.'],
        ['03', 'Keep your report', 'Sign in to My reports, check the status, and download your PDF when it is ready.']
      ].map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      <section className="public-container home-report-cta"><div className="home-report-cta-icon"><FileCheck2 size={31} strokeWidth={1.4} /></div><div><span>ALREADY VISITED THE LAB?</span><h2>Your reports are just a sign-in away.</h2><p>Use your registered mobile number to pick up where you left off.</p></div><Link to="/patient/report" className="public-button">Open My reports <ArrowRight size={17} /></Link></section>
      <section className="home-section home-help"><div className="public-container home-help-grid"><div><span className="public-eyebrow">A LITTLE HELP BEFORE YOU START</span><h2>Good questions.<br />{' '}Simple answers.</h2><p>Need something else? We’re here to help.</p><a className="home-text-link" href={LAB_PHONE_LINK}><Phone size={15} /> Speak to the lab</a></div><div className="home-faqs">{QUESTIONS.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div></div></section>
      <section id="contact" className="home-contact"><div className="public-container home-contact-grid"><div><span className="public-eyebrow">COME SAY HELLO</span><h2>Care starts with a conversation.</h2><p>Visit Pure Path Lab or call our team to plan your next test.</p></div><div><p><MapPin size={19} /><span>{LAB_PROFILE.address}</span></p><p><Clock3 size={19} /><span>Mon–Sat: {LAB_PROFILE.operatingHours.weekdays}<br />Sun: {LAB_PROFILE.operatingHours.sunday}</span></p><a href={LAB_PHONE_LINK} className="home-text-link">Call {LAB_PROFILE.phone} <ArrowUpRight size={16} /></a></div></div></section>
    </main>
    <PublicFooter />
  </div>;
}
