import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  FlaskConical,
  UtensilsCrossed,
  Building2,
  Scale,
  LayoutGrid,
  LogOut,
  ChevronRight,
  Check,
  CheckCircle2,
  Search,
  Plus,
  Minus,
  Printer,
  ReceiptText,
  CalendarDays,
  ClipboardList,
  Settings2,
  Users,
  Menu as MenuIcon,
  X,
  ShieldCheck,
  MapPin,
  Wifi,
  Car,
  Clock3,
  Mail,
  Phone,
  Info,
  Download,
  RefreshCw,
  Save,
  LockKeyhole,
  FileText,
  UserRound,
  ExternalLink,
  BedDouble,
  MessageSquare,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { api, send, money, when, businessDate, csv } from "./api";

const Context = createContext(null);
export const useApp = () => useContext(Context);
export function Field({ label, children, hint, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Button({
  children,
  busy,
  variant = "",
  className = "",
  ...props
}) {
  return (
    <button
      className={`btn ${variant} ${className}`}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <Loader2 size={16} className="spin" /> : null}
      {children}
    </button>
  );
}
export function ErrorBox({ error }) {
  return error ? (
    <div role="alert" className="error-box">
      <Info size={17} />
      {error}
    </div>
  ) : null;
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null),
    before = useRef(document.activeElement);
  useEffect(() => {
    ref.current?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      before.current?.focus?.();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const nodes = [
            ...ref.current.querySelectorAll(
              "button,input,select,textarea,a[href]",
            ),
          ].filter((n) => !n.disabled);
          if (!nodes.length) return;
          const first = nodes[0],
            last = nodes.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <section
        tabIndex={-1}
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  text = "New records will appear here.",
}) {
  return (
    <div className="empty">
      <ClipboardList size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Badge({ status }) {
  return (
    <span
      className={`badge ${["Confirmed", "Finalised", "Closed", "Checked out"].includes(status) ? "green" : ["Cancelled", "Declined"].includes(status) ? "red" : "blue"}`}
    >
      <i />
      {status}
    </span>
  );
}
export function Heading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function useLoad(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    api(path)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, error, reload: () => setRevision((x) => x + 1), setData };
}

function Brand() {
  const { pub } = useApp();
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <LayoutGrid size={21} />
      </span>
      <span>
        {pub?.settings.brand || "Business Hub"}
        <small>Services & operations</small>
      </span>
    </Link>
  );
}
function PublicLayout() {
  const [mobile, setMobile] = useState(false);
  const { user, pub } = useApp();
  const location = useLocation();
  useEffect(() => setMobile(false), [location.pathname]);
  return (
    <div className="public">
      <header className="public-header">
        <div className="header-inner">
          <Brand />
          <nav
            className={mobile ? "public-nav open" : "public-nav"}
            aria-label="Main navigation"
          >
            <NavLink to="/" end>
              Overview
            </NavLink>
            <NavLink to="/hotel">Hotel stays</NavLink>
            <NavLink to="/legal">Legal services</NavLink>
          </nav>
          <Link className="staff-link" to={user ? "/admin" : "/login"}>
            <LockKeyhole size={15} />
            <span>{user ? "Workspace" : "Staff sign in"}</span>
            <ArrowUpRight size={15} />
          </Link>
          <button
            className="mobile-menu icon-button"
            onClick={() => setMobile(!mobile)}
            aria-label="Toggle menu"
            aria-expanded={mobile}
          >
            {mobile ? <X /> : <MenuIcon />}
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="public-footer">
        <div>
          <Brand />
          <p>Everyday services, thoughtfully connected.</p>
        </div>
        <div className="footer-meta">
          <span>
            © {new Date().getFullYear()}{" "}
            {pub?.settings.brand || "Business Hub"}
          </span>
          {pub?.settings.phone && (
            <a href={`tel:${pub.settings.phone}`}>
              <Phone size={14} />
              {pub.settings.phone}
            </a>
          )}
          {pub?.settings.email && (
            <a href={`mailto:${pub.settings.email}`}>
              <Mail size={14} />
              {pub.settings.email}
            </a>
          )}
          <Link to="/login">
            Staff access <ArrowUpRight size={13} />
          </Link>
        </div>
      </footer>
    </div>
  );
}
function Home() {
  const { pub } = useApp();
  return (
    <>
      <section className="home-hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="hero-label">
              <span />
              WELCOME TO YOUR BUSINESS HUB
            </span>
            <h1>
              One destination.
              <br />
              <em>More possibilities.</em>
            </h1>
            <p>{pub.settings.intro}</p>
            <a href="#services" className="btn">
              Explore our services <ArrowRight size={17} />
            </a>
            <div className="hero-note">
              <ShieldCheck size={17} />
              Simple access. Personal assistance.
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit-core">
              <LayoutGrid size={42} />
              <span>All together.</span>
            </div>
            <div className="floating-tile tile-lab">
              <FlaskConical />
              <div>
                Path Lab<small>Health & diagnostics</small>
              </div>
            </div>
            <div className="floating-tile tile-hotel">
              <BedDouble />
              <div>
                Hotel stays<small>A place to unwind</small>
              </div>
            </div>
            <div className="floating-tile tile-legal">
              <Scale />
              <div>
                Legal services<small>Guidance that matters</small>
              </div>
            </div>
            <div className="floating-tile tile-pos">
              <ReceiptText />
              <div>
                Restaurant POS<small>Made for your team</small>
              </div>
            </div>
            <span className="visual-caption">
              FOUR SERVICES. ONE CONNECTED EXPERIENCE.
            </span>
          </div>
        </div>
      </section>
      <section id="services" className="section services-section">
        <div className="section-top">
          <div>
            <div className="eyebrow">HOW CAN WE HELP?</div>
            <h2>Choose where to begin</h2>
          </div>
          <p>A clear next step, whatever brings you here.</p>
        </div>
        <div className="service-grid">
          <ServiceCard
            number="01"
            icon={FlaskConical}
            title="Path Lab"
            tag="HEALTH & DIAGNOSTICS"
            text="Connect with our laboratory for diagnostic services and patient support."
            action="Visit Path Lab"
            external
            to="/pathlab/"
          />
          <ServiceCard
            number="02"
            icon={UtensilsCrossed}
            title="Restaurant POS"
            tag="FOR OUR TEAM"
            text="A focused workspace to create bills, print receipts and manage daily sales."
            action="Open billing"
            to="/admin/pos"
          />
          <ServiceCard
            number="03"
            icon={Scale}
            title="Legal services"
            tag="ADVICE & ASSISTANCE"
            text="Explore our services and tell us what you need. Our team will take it from there."
            action="Explore services"
            to="/legal"
          />
          <ServiceCard
            number="04"
            icon={Building2}
            title="Hotel stays"
            tag="STAY & UNWIND"
            text="Find your room, share your dates and let us help you plan a comfortable stay."
            action="Find your stay"
            to="/hotel"
          />
        </div>
        <div className="assistance-bar">
          <span className="soft-icon">
            <MessageSquare size={21} />
          </span>
          <div>
            <strong>A real person, every step of the way.</strong>
            <p>Hotel and legal requests are reviewed personally by our team.</p>
          </div>
          <span className="assistance-end">
            Thoughtful service <ArrowUpRight size={17} />
          </span>
        </div>
      </section>

    </>
  );
}
function ServiceCard({
  number,
  icon: Icon,
  title,
  tag,
  text,
  action,
  to,
  onClick,
  external,
}) {
  const content = (
    <>
      <div className="service-card-top">
        <span className="service-icon">
          <Icon size={25} />
        </span>
        <span className="card-number">{number}</span>
      </div>
      <small className="card-tag">{tag}</small>
      <h3>{title}</h3>
      <p>{text}</p>
      <span className="card-action">
        {action}
        {external ? <ArrowUpRight size={18} /> : <ArrowRight size={18} />}
      </span>
    </>
  );
  return external ? (
    to ? (
      <a
        className="service-card"
        href={to}
        target={to.startsWith("/") ? undefined : "_blank"}
        rel={to.startsWith("/") ? undefined : "noreferrer"}
      >
        {content}
      </a>
    ) : (
      <button className="service-card" onClick={onClick}>
        {content}
      </button>
    )
  ) : (
    <Link className="service-card" to={to}>
      {content}
    </Link>
  );
}
function RoomArt({ index = 0 }) {
  return (
    <div className={`room-art tone-${index % 3}`} aria-hidden="true">
      <div className="room-window">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="room-lamp" />
      <div className="room-bed">
        <span />
        <span />
        <i />
      </div>
      <div className="room-table" />
      <div className="room-floor" />
      <span className="room-art-caption">ROOM ILLUSTRATION</span>
    </div>
  );
}
function Success({ kind, reference, onAgain }) {
  return (
    <div className="success-panel">
      <span className="success-icon">
        <Check size={30} />
      </span>
      <div className="eyebrow">REQUEST RECEIVED</div>
      <h2>Thank you. We’ll take it from here.</h2>
      <p>
        {kind === "hotel"
          ? "Our team will contact you to confirm availability and the final price. Your room is not yet reserved."
          : "Our team will review your enquiry and contact you using the details provided."}
      </p>
      <div className="reference-box">
        <small>YOUR REFERENCE</small>
        <strong>{reference}</strong>
        <span>Please keep this for your records.</span>
      </div>
      <Button variant="secondary" onClick={onAgain}>
        Submit another request <ArrowRight size={16} />
      </Button>
    </div>
  );
}
function ContactFields() {
  return (
    <>
      <div className="form-grid">
        <Field
          label="Full name *"
          name="name"
          autoComplete="name"
          maxLength={100}
          required
        />
        <Field
          label="Phone number *"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={25}
          pattern="[+0-9 ()\-]{7,25}"
          required
        />
      </div>
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={180}
        hint="Optional. Our team will use your contact details to follow up."
      />
      <label className="honeypot" aria-hidden="true">
        Leave this field empty
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </>
  );
}
function Hotel() {
  const { pub } = useApp();
  const [selected, setSelected] = useState(null),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const idem = useRef(crypto.randomUUID());
  const s = pub.settings;
  const room = pub.rooms.find((r) => r.id === selected);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await send("/public/requests", {
        ...f,
        kind: "hotel",
        roomId: selected,
        adults: Number(f.adults),
        children: Number(f.children),
        rooms: Number(f.rooms),
        idempotency: idem.current,
      });
      setResult(r);
      idem.current = crypto.randomUUID();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="public-page-hero">
        <div className="section">
          <Link className="back-link" to="/">
            <ArrowLeft size={14} />
            All services
          </Link>
          <div className="eyebrow">A LITTLE ROOM TO UNWIND</div>
          <h1>{s.hotelName}</h1>
          <p>{s.hotelDescription}</p>
          <div className="inline-meta">
            <span>
              <MapPin size={16} />
              {s.hotelLocation}
            </span>
            <span>
              <CalendarDays size={16} />
              Request now. Confirm with our team.
            </span>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-top">
          <div>
            <div className="eyebrow">MAKE YOURSELF AT HOME</div>
            <h2>Find your kind of stay</h2>
          </div>
          <span className="muted">
            Indicative rates · Subject to confirmation
          </span>
        </div>
        <div className="room-grid">
          {pub.rooms.map((r, i) => (
            <article className="room-card" key={r.id}>
              {r.imageUrl ? (
                <img
                  className="room-photo"
                  src={r.imageUrl}
                  alt={r.name}
                  loading="lazy"
                />
              ) : (
                <RoomArt index={i} />
              )}
              <div className="room-card-body">
                <div className="room-title">
                  <h3>{r.name}</h3>
                  <span>
                    <Users size={14} />
                    Up to {r.occupancy}
                  </span>
                </div>
                <p>{r.description}</p>
                <div className="amenities">
                  {r.amenities
                    .split(",")
                    .filter(Boolean)
                    .map((a) => (
                      <span key={a}>{a.trim()}</span>
                    ))}
                </div>
                <div className="room-bottom">
                  <div>
                    <strong>{money(r.price * 100)}</strong>
                    <small> / night, indicative</small>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelected(r.id);
                      setResult(null);
                      setError("");
                    }}
                  >
                    Request stay <ArrowUpRight size={15} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="hotel-details">
          <div>
            <h3>Comforts that make a difference</h3>
            <div className="hotel-amenities">
              {s.hotelAmenities.split(",").map((a, i) => {
                const Icon = [Wifi, Car, UtensilsCrossed, Building2][i % 4];
                return (
                  <span key={i}>
                    <Icon size={19} />
                    {a.trim()}
                  </span>
                );
              })}
            </div>
          </div>
          <div>
            <h3>Before you book</h3>
            <p>{s.hotelPolicies}</p>
            <p>
              Submitting a request does not reserve a room. No online payment is
              collected.
            </p>
          </div>
        </div>
        {!pub.rooms.length && (
          <Empty
            title="Room details are being updated"
            text="Please check back soon."
          />
        )}
      </section>
      {room && (
        <Modal
          title={result ? "Request received" : `Request a stay · ${room.name}`}
          onClose={() => setSelected(null)}
        >
          {result ? (
            <Success
              kind="hotel"
              reference={result.reference}
              onAgain={() => setResult(null)}
            />
          ) : (
            <form onSubmit={submit} className="stack">
              <div className="notice">
                <Info size={18} />
                <p>
                  Send your preferences. Our team will confirm availability and
                  the final price.
                </p>
              </div>
              <ContactFields />
              <div className="form-grid">
                <Field
                  label="Check-in *"
                  name="checkIn"
                  type="date"
                  min={businessDate()}
                  required
                />
                <Field
                  label="Check-out *"
                  name="checkOut"
                  type="date"
                  min={businessDate()}
                  required
                />
              </div>
              <div className="form-grid three">
                <Field
                  label="Adults *"
                  name="adults"
                  type="number"
                  min="1"
                  max="40"
                  defaultValue="2"
                  required
                />
                <Field
                  label="Children"
                  name="children"
                  type="number"
                  min="0"
                  max="40"
                  defaultValue="0"
                  required
                />
                <Field
                  label="Rooms *"
                  name="rooms"
                  type="number"
                  min="1"
                  max="10"
                  defaultValue="1"
                  required
                />
              </div>
              <Field label="Special requests">
                <textarea name="message" rows={3} maxLength={3000} />
              </Field>
              <ErrorBox error={error} />
              <Button busy={busy} type="submit">
                Send booking request <ArrowRight size={16} />
              </Button>
              <small className="muted">
                Your details will be used by our team to follow up on this
                request.
              </small>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
function Legal() {
  const { pub } = useApp();
  const [selected, setSelected] = useState(pub.services[0]?.id || ""),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const form = useRef(null),
    idem = useRef(crypto.randomUUID());
  const service = pub.services.find((s) => s.id === selected);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget)),
      answers = {};
    service.fields.forEach((field, i) => {
      answers[field.name] = f[`question-${i}`] || "";
      delete f[`question-${i}`];
    });
    try {
      const r = await send("/public/requests", {
        ...f,
        kind: "legal",
        serviceId: selected,
        answers,
        idempotency: idem.current,
      });
      setResult(r);
      idem.current = crypto.randomUUID();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="public-page-hero">
        <div className="section">
          <Link className="back-link" to="/">
            <ArrowLeft size={14} />
            All services
          </Link>
          <div className="eyebrow">CLARITY STARTS WITH A CONVERSATION</div>
          <h1>
            Legal assistance,
            <br />
            with a personal approach.
          </h1>
          <p>
            Choose the service you need and tell us a little about your
            situation. Our team will help you understand the next steps.
          </p>
        </div>
      </section>
      <section className="section legal-layout">
        <aside>
          <div className="eyebrow">OUR SERVICES</div>
          <h2>How can we help?</h2>
          <div className="legal-service-list">
            {pub.services.map((s, i) => (
              <button
                key={s.id}
                className={selected === s.id ? "selected" : ""}
                onClick={() => {
                  setSelected(s.id);
                  setResult(null);
                  setError("");
                  idem.current = crypto.randomUUID();
                }}
              >
                <span className="legal-index">0{i + 1}</span>
                <span>
                  {s.name}
                  <small>{s.category}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          <div className="legal-aside-note">
            <ShieldCheck size={22} />
            <strong>A considered next step</strong>
            <p>
              Start with a short enquiry. No payment or document upload is
              needed.
            </p>
          </div>
        </aside>
        <div className="legal-main">
          {!service ? (
            <Empty title="Services are being updated" />
          ) : result ? (
            <Success
              kind="legal"
              reference={result.reference}
              onAgain={() => setResult(null)}
            />
          ) : (
            <>
              <div className="service-description">
                <span className="soft-icon">
                  <Scale size={23} />
                </span>
                <span className="pill">{service.category}</span>
                <h2>{service.name}</h2>
                <h3>{service.summary}</h3>
                <p>{service.description}</p>
              </div>
              <form
                ref={form}
                key={selected}
                onSubmit={submit}
                className="legal-form stack"
              >
                <div>
                  <h3>Tell us what you need</h3>
                  <p className="muted">Fields marked * are required.</p>
                </div>
                <ContactFields />
                <Field
                  label="City / location *"
                  name="location"
                  maxLength={200}
                  required
                />
                {service.fields.map((f, i) => (
                  <Field
                    key={f.name}
                    label={`${f.name}${f.required ? " *" : ""}`}
                    name={`question-${i}`}
                    maxLength={500}
                    required={f.required}
                  />
                ))}
                <Field label="Briefly describe your requirement *">
                  <textarea name="message" rows={4} maxLength={3000} required />
                </Field>
                <ErrorBox error={error} />
                <div className="form-end">
                  <small>Your enquiry will be reviewed by our team.</small>
                  <Button busy={busy} type="submit">
                    Send enquiry <ArrowRight size={16} />
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </>
  );
}
function Login() {
  const { user, setUser } = useApp(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    navigate = useNavigate(),
    location = useLocation();
  if (user) return <Navigate to={location.state?.from || "/admin"} replace />;
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await send(
        "/login",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      setUser(u);
      navigate(location.state?.from || "/admin", { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-wrap">
      <div className="login-art">
        <LayoutGrid size={42} />
        <h2>
          A little more organised.
          <br />A lot more possible.
        </h2>
        <p>Your workspace for billing, bookings and enquiries.</p>
        <div className="login-art-lines" />
      </div>
      <div className="login-card">
        <Link to="/" className="back-link">
          <ArrowLeft size={15} />
          Back to website
        </Link>
        <span className="soft-icon">
          <LockKeyhole size={24} />
        </span>
        <div className="eyebrow">STAFF WORKSPACE</div>
        <h1>Welcome back.</h1>
        <p>Sign in with your staff account to continue.</p>
        <form className="stack" onSubmit={submit}>
          <Field
            label="Email address"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <ErrorBox error={error} />
          <Button busy={busy} type="submit">
            Sign in <ArrowRight size={17} />
          </Button>
        </form>
        <p className="login-help">
          Need access or a password reset?
          <br />
          Please contact your business owner.
        </p>
      </div>
    </div>
  );
}
function Protected() {
  const { user, authLoading } = useApp(),
    location = useLocation();
  if (authLoading)
    return (
      <div className="loading">
        <Loader2 className="spin" />
        Checking your session…
      </div>
    );
  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ from: location.pathname }} replace />
  );
}
const nav = [
  [
    "",
    "Overview",
    LayoutGrid,
    ["owner", "restaurant", "cashier", "hotel", "legal"],
  ],
  ["pos", "New bill", Plus, ["owner", "restaurant", "cashier"]],
  ["bills", "Bill history", ReceiptText, ["owner", "restaurant", "cashier"]],
  ["hotel", "Hotel requests", CalendarDays, ["owner", "hotel"]],
  ["legal", "Legal enquiries", Scale, ["owner", "legal"]],
  ["menu", "Menu items", UtensilsCrossed, ["owner", "restaurant"]],
  ["rooms", "Room types", BedDouble, ["owner", "hotel"]],
  ["services", "Legal services", FileText, ["owner", "legal"]],
  [
    "settings",
    "Business settings",
    Settings2,
    ["owner", "restaurant", "hotel"],
  ],
  ["staff", "Staff & access", Users, ["owner"]],
];
function AdminLayout() {
  const { user, setUser } = useApp(),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const item = nav.find(
    (n) => location.pathname === "/admin" + (n[0] ? "/" + n[0] : ""),
  );
  const allowed = !item || item[3].includes(user.role);
  return (
    <div className="admin-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-menu icon-button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">BUSINESS WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          {nav
            .filter((n) => n[3].includes(user.role))
            .map(([path, label, Icon]) => (
              <NavLink key={path} to={"/admin" + (path ? "/" + path : "")} end>
                <Icon size={18} />
                {label}
                {path === "" && <span className="nav-dot" />}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/">
            <ExternalLink size={17} />
            View public website
          </Link>
          <div className="profile">
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "owner" ? "Business owner" : user.role}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await send("/logout", {});
                  setUser(null);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="sidebar-shade" onClick={() => setOpen(false)} />}
      <div className="admin-main">
        <header className="admin-header">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <MenuIcon size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{item?.[1] || "Overview"}</strong>
          </div>
          <span className="header-date">
            <CalendarDays size={15} />
            {new Intl.DateTimeFormat("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Kolkata",
            }).format(new Date())}
          </span>
        </header>
        <div className="admin-content">
          <ErrorBox error={error} />
          {allowed ? (
            <Outlet />
          ) : (
            <Empty
              title="Access restricted"
              text="Your account does not have access to this area."
            />
          )}
        </div>
        <footer className="admin-footer">
          Business Hub workspace<span>India Standard Time · IST</span>
        </footer>
      </div>
    </div>
  );
}

// Workspace pages are kept in a separate module so public navigation stays lightweight.
import {
  Dashboard,
  POS,
  Bills,
  Requests,
  Catalog,
  Settings,
  Staff,
} from "./Workspace.jsx";
export default function App() {
  const appLocation = useLocation();
  useEffect(() => {
    // Effects must not return the value of browser APIs as a cleanup callback.
    window.scrollTo(0, 0);
  }, [appLocation.pathname]);
  const [pub, setPub] = useState(null),
    [user, setUser] = useState(null),
    [authLoading, setAuthLoading] = useState(true),
    [error, setError] = useState("");
  async function refreshPublic() {
    setPub(await api("/public"));
  }
  useEffect(() => {
    refreshPublic().catch((e) => setError(e.message));
    api("/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);
  if (!pub)
    return (
      <div className="loading">
        {error ? (
          <>
            <ErrorBox error={error} />
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </>
        ) : (
          <>
            <Loader2 className="spin" />
            Opening your business hub…
          </>
        )}
      </div>
    );
  return (
    <Context.Provider
      value={{ pub, user, setUser, authLoading, refreshPublic }}
    >
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="hotel" element={<Hotel />} />
          <Route path="legal" element={<Legal />} />
          <Route path="login" element={<Login />} />
        </Route>
        <Route element={<Protected />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="bills" element={<Bills />} />
            <Route path="hotel" element={<Requests kind="hotel" />} />
            <Route path="legal" element={<Requests kind="legal" />} />
            <Route path="menu" element={<Catalog kind="menu" />} />
            <Route path="rooms" element={<Catalog kind="rooms" />} />
            <Route path="services" element={<Catalog kind="services" />} />
            <Route path="settings" element={<Settings />} />
            <Route path="staff" element={<Staff />} />
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <div className="loading">
              <h1>Page not found</h1>
              <Link className="btn" to="/">
                Return home
              </Link>
            </div>
          }
        />
      </Routes>
    </Context.Provider>
  );
}
