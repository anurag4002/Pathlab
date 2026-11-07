import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Clock3, MapPin, MessageCircle, Navigation, Phone, Search, X } from 'lucide-react';
import { getPriceList } from '../../../services/publicService';
import { LAB_PROFILE } from '../../../constants/landingContent';
import { SiteActionBar, SiteFooter, SiteHeader } from '../../../components/public/site/SiteChrome';
import SpecimenLabel from '../../../components/public/site/SpecimenLabel';
import useLabInfo, { openStatus } from '../../../components/public/site/useLabInfo';
import './site.css';

const rupees = (v) => (Number.isFinite(Number(v)) ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'Ask the lab');
// The price list is remembered in this browser, so a repeat visit shows it at
// once while the fresh list loads quietly behind it.
const PRICE_KEY = 'pps_price_list';
const readPrices = () => { try { return JSON.parse(localStorage.getItem(PRICE_KEY) || 'null'); } catch { return null; } };

// Tube-cap colour per kind of test - the colour the lab's sample tube for it
// actually has (lavender = blood count, gold = chemistry, sky = clotting...).
const CAPS = [
  [/sero|immun|infect|micro|viral|culture/i, 'ruby'],
  [/coag|clot|pt\b|aptt/i, 'sky'],
  [/haemat|hemat|blood count|cbc/i, 'lavender'],
  [/bio|chem|hormone|endocr|thyroid|lipid|liver|kidney|renal|diabet|sugar/i, 'gold'],
  [/urine|stool|clinical path|fluid/i, 'green'],
];
const capFor = (category = '') => (CAPS.find(([re]) => re.test(category)) || [null, 'slate'])[1];

function ReportFinder() {
  const info = useLabInfo();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');
  const thisYear = new Date().getFullYear();
  const submit = (event) => {
    event.preventDefault();
    if (phone.length !== 10) { setError('Enter the 10-digit mobile number you gave at the lab.'); return; }
    if (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > thisYear) { setError('Enter the year you were born, like 1988.'); return; }
    // Details go to the report page in memory only - never in the address bar.
    navigate('/patient/report', { state: { signIn: { phone, birthYear: year } } });
  };
  return (
    <SpecimenLabel code={phone} lab={info.labName} kind="Patient copy" className="pps-hero-label">
      <form className="pps-finder" onSubmit={submit} noValidate>
        <p className="pps-finder-title">Find your report</p>
        <label className="pps-field">
          <span>Mobile number</span>
          <span className="pps-input pps-input-phone">
            <em>+91</em>
            <input type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit number" value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }} aria-describedby="finder-help" />
          </span>
        </label>
        <label className="pps-field">
          <span>Year of birth</span>
          <span className="pps-input">
            <input type="text" inputMode="numeric" autoComplete="bday-year" placeholder="e.g. 1988" value={year}
              onChange={(e) => { setYear(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }} />
          </span>
        </label>
        {error && <p className="pps-error" role="alert">{error}</p>}
        <button type="submit" className="pps-btn pps-btn-blue pps-btn-block">Show my reports <ArrowRight size={17} aria-hidden="true" /></button>
        <p id="finder-help" className="pps-finder-alt">Don&apos;t know the year given at the lab? <Link to="/patient/report" state={{ method: 'otp' }}>Get a code on your phone instead</Link></p>
      </form>
    </SpecimenLabel>
  );
}

function PriceCheck() {
  const [data, setData] = useState(() => readPrices() || { tests: [], packages: [] });
  const [loading, setLoading] = useState(() => !readPrices());
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState('tests');
  const [query, setQuery] = useState('');
  const [cap, setCap] = useState('');
  const [limit, setLimit] = useState(8);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    getPriceList().then((res) => {
      if (!alive || !res?.success) return;
      const next = { tests: res.data?.tests || [], packages: res.data?.packages || [] };
      setData(next);
      try { localStorage.setItem(PRICE_KEY, JSON.stringify(next)); } catch { /* full or blocked */ }
    }).catch(() => { if (alive && !readPrices()) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [retry]);

  const list = kind === 'tests' ? data.tests : data.packages;
  const groups = useMemo(() => {
    if (kind !== 'tests') return [];
    const count = {};
    data.tests.forEach((t) => { const c = capFor(t.category); count[c] = (count[c] || 0) + 1; });
    const names = { lavender: 'Blood count', gold: 'Chemistry & hormones', sky: 'Clotting', ruby: 'Infection & immunity', green: 'Urine & fluids', slate: 'Other tests' };
    return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ cap: c, label: names[c], n }));
  }, [data.tests, kind]);
  const q = query.trim().toLowerCase();
  const shown = list.filter((i) => (!cap || capFor(i.category) === cap) && (!q || `${i.name} ${i.code || ''} ${i.category || ''}`.toLowerCase().includes(q)));

  return (
    <section id="prices" className="pps-section pps-prices" aria-labelledby="prices-title">
      <div className="pps-wrap">
        <div className="pps-section-head">
          <h2 id="prices-title">What does a test cost?</h2>
          <p>Prices straight from the lab&apos;s own list. Book online, pay at the lab.</p>
        </div>
        <div className="pps-search">
          <Search size={20} aria-hidden="true" />
          <input type="search" placeholder={kind === 'tests' ? 'Search a test - e.g. thyroid, CBC, sugar' : 'Search a health check-up'} aria-label="Search tests and packages"
            value={query} onChange={(e) => { setQuery(e.target.value); setLimit(8); }} />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}
          <div className="pps-kind" role="group" aria-label="Show">
            <button type="button" aria-pressed={kind === 'tests'} onClick={() => { setKind('tests'); setCap(''); setLimit(8); }}>Tests <span>{data.tests.length || ''}</span></button>
            <button type="button" aria-pressed={kind === 'packages'} onClick={() => { setKind('packages'); setCap(''); setLimit(8); }}>Check-ups <span>{data.packages.length || ''}</span></button>
          </div>
        </div>
        {groups.length > 1 && (
          <div className="pps-caps" role="group" aria-label="Kind of test">
            {groups.map((g) => (
              <button key={g.cap} type="button" aria-pressed={cap === g.cap} onClick={() => { setCap(cap === g.cap ? '' : g.cap); setLimit(8); }}>
                <i className={`cap-${g.cap}`} aria-hidden="true" />{g.label}
              </button>
            ))}
          </div>
        )}
        {failed && <p className="pps-note" role="status">Prices could not be loaded right now. <button type="button" className="pps-link" onClick={() => setRetry((n) => n + 1)}>Try again</button></p>}
        <ul className="pps-price-list" aria-busy={loading || undefined}>
          {loading ? [0, 1, 2, 3].map((i) => <li key={i} className="pps-price-skel"><span /><span /></li>) : shown.slice(0, limit).map((item) => {
            const isPkg = kind === 'packages';
            const c = isPkg ? 'gold' : capFor(item.category);
            return (
              <li key={item._id}>
                <i className={`pps-cap cap-${c}`} aria-hidden="true" />
                <div className="pps-price-name">
                  <b>{item.name}</b>
                  <small>{isPkg ? `${item.testCount || 0} tests in one visit` : [item.category, item.code].filter(Boolean).join(' · ')}</small>
                </div>
                <span className="pps-price">{rupees(item.price)}</span>
                <Link className="pps-btn pps-btn-line pps-btn-sm" to={`/patient/report?tab=book&${isPkg ? 'package' : 'test'}=${encodeURIComponent(item._id)}`} aria-label={`Book ${item.name}`}>Book</Link>
              </li>
            );
          })}
        </ul>
        {!loading && !shown.length && (
          <p className="pps-empty">{q ? `No test called "${query}" on the list. Call the lab - it may go by another name.` : 'Nothing listed here yet. Call the lab for prices.'}</p>
        )}
        {!loading && shown.length > limit && (
          <button type="button" className="pps-more" onClick={() => setLimit((n) => n + 12)}>Show more <ChevronDown size={16} aria-hidden="true" /></button>
        )}
      </div>
    </section>
  );
}

const FAQ = [
  ['How do I get my report?', 'Use "Find your report" at the top of this page with the mobile number and year of birth you gave at the lab. Ready reports open as a PDF you can download or share. If the year doesn\'t work, choose "Get a code on your phone".'],
  ['Do I need to come empty stomach?', 'Only for some tests - sugar (fasting), lipid profile and a few others need 8-12 hours without food. Water is fine. If unsure, call the lab before you come.'],
  ['Can I book for my parents or children?', 'Yes. Sign in with your number, choose Book a test and write the name of the person you are booking for. The lab calls to confirm.'],
  ['Do I pay online?', 'No. Booking online only reserves your visit; you pay at the lab.'],
  ['My report says "In progress".', 'It is still being tested or checked by the doctor. Check again later, or call the lab to ask when it will be ready.'],
];

export default function Home() {
  const info = useLabInfo();
  const { hash } = useLocation();
  const status = openStatus(LAB_PROFILE.openHours);
  useEffect(() => {
    document.title = `${info.labName} - pathology & imaging, Gonda`;
  }, [info.labName]);
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  return (
    <div className="pps">
      <SiteHeader />
      <main id="site-main">
        <section className="pps-hero">
          <div className="pps-wrap pps-hero-grid">
            <div className="pps-hero-copy">
              <p className="pps-hindi" lang="hi">आपकी रिपोर्ट, आपके फ़ोन पर</p>
              <h1>Your report,<br />the moment<br /><span>it&apos;s ready.</span></h1>
              <p className="pps-lede">{info.labName} is the pathology and imaging lab in Gonda. Find your report, check what a test costs, or book your visit - all from your phone.</p>
              <ul className="pps-facts">
                <li className={status.open ? 'is-open' : 'is-closed'}><Clock3 size={16} aria-hidden="true" />{status.text}</li>
                <li><MapPin size={16} aria-hidden="true" />Beside the District Hospital</li>
              </ul>
              <div className="pps-hero-links">
                <Link to="/patient/report?tab=book" className="pps-btn pps-btn-dark">Book a test <ArrowRight size={17} aria-hidden="true" /></Link>
                <a href="#prices" className="pps-btn pps-btn-light">See prices</a>
              </div>
            </div>
            <ReportFinder />
          </div>
        </section>

        <PriceCheck />

        <section id="visit" className="pps-section pps-visit" aria-labelledby="visit-title">
          <div className="pps-wrap">
            <div className="pps-section-head">
              <h2 id="visit-title">From sample to your phone</h2>
              <p>What happens after you walk in.</p>
            </div>
            <ol className="pps-steps">
              <li><b>Book or just walk in</b><span>Book online to skip the wait, or come straight to the lab - no booking needed.</span></li>
              <li><b>Sample, labelled at once</b><span>Your sample gets a barcode label the moment it is taken, so it can&apos;t be mixed up.</span></li>
              <li><b>Checked and signed</b><span>Results are checked by the doctor and signed before anything is sent.</span></li>
              <li><b>On your phone</b><span>Open it here with your mobile number, download the PDF and share it with your doctor.</span></li>
            </ol>
          </div>
        </section>

        <section id="find-us" className="pps-section pps-findus" aria-labelledby="findus-title">
          <div className="pps-wrap pps-findus-grid">
            <div>
              <h2 id="findus-title">Come to the lab</h2>
              <p className="pps-address">{info.address}</p>
              <p className={`pps-status ${status.open ? 'is-open' : 'is-closed'}`}><i aria-hidden="true" />{status.text}</p>
              <div className="pps-findus-actions">
                <a href={info.telLink} className="pps-btn pps-btn-dark"><Phone size={16} aria-hidden="true" /> Call {info.phoneDisplay}</a>
                {info.whatsappLink && <a href={info.whatsappLink} className="pps-btn pps-btn-light" target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> WhatsApp</a>}
                {info.mapsLink && <a href={info.mapsLink} className="pps-btn pps-btn-light" target="_blank" rel="noreferrer"><Navigation size={16} aria-hidden="true" /> Directions</a>}
              </div>
            </div>
            <dl className="pps-hours" aria-label="Opening hours">
              <div><dt>Monday - Saturday</dt><dd>{LAB_PROFILE.operatingHours.weekdays}</dd></div>
              <div><dt>Sunday</dt><dd>{LAB_PROFILE.operatingHours.sunday}</dd></div>
              <div><dt>Fasting samples</dt><dd>From 7:00 AM, every day</dd></div>
            </dl>
          </div>
        </section>

        <section className="pps-section pps-faq" aria-labelledby="faq-title">
          <div className="pps-wrap pps-faq-grid">
            <h2 id="faq-title">Before you come</h2>
            <div>
              {FAQ.map(([q, a]) => (
                <details key={q}><summary>{q}<ChevronDown size={18} aria-hidden="true" /></summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <SiteActionBar />
    </div>
  );
}
