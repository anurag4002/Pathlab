import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Minus,
  Search,
  Printer,
  Save,
  ReceiptText,
  CalendarDays,
  Scale,
  Download,
  Users,
  Clock3,
  Check,
  CheckCircle2,
  RefreshCw,
  X,
  Settings2,
  UtensilsCrossed,
  BedDouble,
  FileText,
  Info,
  IndianRupee,
  Trash2,
  Edit3,
} from "lucide-react";
import {
  useApp,
  useLoad,
  Field,
  Button,
  ErrorBox,
  Modal,
  Empty,
  Badge,
  Heading,
} from "./App";
import { api, send, money, when, businessDate, csv } from "./api";

const canRestaurant = (u) =>
  ["owner", "restaurant", "cashier"].includes(u.role);
const hotelStatuses = [
  "New",
  "Contacted",
  "Awaiting response",
  "Confirmed",
  "Declined",
  "Cancelled",
  "Checked in",
  "Checked out",
];
const legalStatuses = [
  "New",
  "Assigned",
  "Contacted",
  "Awaiting information",
  "In progress",
  "Closed",
];
const shortDate = (v) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(v));
export function Dashboard() {
  const { user } = useApp();
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const tasks = [
      canRestaurant(user) ? api("/bills") : Promise.resolve([]),
      ["owner", "hotel"].includes(user.role)
        ? api("/requests/hotel")
        : Promise.resolve([]),
      ["owner", "legal"].includes(user.role)
        ? api("/requests/legal")
        : Promise.resolve([]),
    ];
    Promise.all(tasks)
      .then(([bills, hotel, legal]) => setData({ bills, hotel, legal }))
      .catch((e) => setError(e.message));
  }, [user.role]);
  const today = businessDate();
  const sales =
    data?.bills.filter(
      (b) =>
        b.status !== "Cancelled" &&
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(b.createdAt)) === today,
    ) || [];
  const pending = (r) =>
    r.filter((x) =>
      [
        "New",
        "Contacted",
        "Awaiting response",
        "Assigned",
        "Awaiting information",
      ].includes(x.status),
    );
  const metrics = [];
  if (canRestaurant(user))
    metrics.push({
      label: "Today’s sales",
      value: money(sales.reduce((a, b) => a + b.value.total, 0)),
      note: `${sales.length} finalised bills today`,
      Icon: IndianRupee,
      to: "/admin/bills",
    });
  if (["owner", "hotel"].includes(user.role))
    metrics.push({
      label: "Hotel requests",
      value: data?.hotel.length || 0,
      note: `${pending(data?.hotel || []).length} awaiting follow-up`,
      Icon: BedDouble,
      to: "/admin/hotel",
    });
  if (["owner", "legal"].includes(user.role))
    metrics.push({
      label: "Legal enquiries",
      value: data?.legal.length || 0,
      note: `${pending(data?.legal || []).length} awaiting follow-up`,
      Icon: Scale,
      to: "/admin/legal",
    });
  const recent = [...(data?.hotel || []), ...(data?.legal || [])]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);
  return (
    <>
      <Heading
        eyebrow="YOUR BUSINESS AT A GLANCE"
        title={`Good to see you, ${user.name.split(" ")[0]}.`}
        description="A clear view of what needs your attention."
      >
        {canRestaurant(user) && (
          <Link className="btn" to="/admin/pos">
            <Plus size={17} />
            Create a bill
          </Link>
        )}
      </Heading>
      <ErrorBox error={error} />
      <div className="metric-grid">
        {metrics.map(({ label, value, note, Icon, to }) => (
          <Link className="metric-card" key={label} to={to}>
            <div>
              <span>{label}</span>
              <span className="soft-icon">
                <Icon size={20} />
              </span>
            </div>
            <strong>{data ? value : "—"}</strong>
            <small>
              {note}
              <ArrowUpRight size={15} />
            </small>
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Latest requests across your services</p>
            </div>
            <Clock3 size={19} />
          </div>
          {recent.length ? (
            <div className="recent-list">
              {recent.map((r) => (
                <Link key={r.id} to={`/admin/${r.kind}`}>
                  <span className="soft-icon">
                    {r.kind === "hotel" ? (
                      <BedDouble size={18} />
                    ) : (
                      <Scale size={18} />
                    )}
                  </span>
                  <div>
                    <strong>{r.value.name}</strong>
                    <small>
                      {r.kind === "hotel"
                        ? r.value.roomName
                        : r.value.serviceName}{" "}
                      · {r.reference}
                    </small>
                  </div>
                  <Badge status={r.status} />
                  <small>{shortDate(r.createdAt)}</small>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title={data ? "You’re all caught up" : "Loading your workspace…"}
              text="New requests will appear here as they arrive."
            />
          )}
        </section>
        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h2>Quick access</h2>
              <p>Your most useful shortcuts</p>
            </div>
          </div>
          {canRestaurant(user) && (
            <Quick
              to="/admin/pos"
              Icon={ReceiptText}
              title="Restaurant billing"
              text="Create a bill and print a receipt"
            />
          )}
          {["owner", "hotel"].includes(user.role) && (
            <Quick
              to="/admin/hotel"
              Icon={CalendarDays}
              title="Hotel requests"
              text="Review dates and confirm a stay"
            />
          )}
          {["owner", "legal"].includes(user.role) && (
            <Quick
              to="/admin/legal"
              Icon={Scale}
              title="Legal enquiries"
              text="Keep every conversation moving"
            />
          )}
          {user.role === "owner" && (
            <Quick
              to="/admin/settings"
              Icon={Settings2}
              title="Business settings"
              text="Personalise your hub"
            />
          )}
        </section>
      </div>
      <div className="workspace-note">
        <Info size={18} />
        <p>
          Check requests regularly and contact customers directly. Hotel
          availability is verified manually before confirmation.
        </p>
      </div>
    </>
  );
}
function Quick({ to, Icon, title, text }) {
  return (
    <Link className="quick-link" to={to}>
      <span className="soft-icon">
        <Icon size={19} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
      <ArrowUpRight size={16} />
    </Link>
  );
}
function Receipt({ bill, copy = false, onClose }) {
  const [error, setError] = useState("");
  const v = bill.value,
    r = v.receipt;
  async function print() {
    try {
      if (bill.id) await send(`/bills/${bill.id}/print`, {});
      window.print();
    } catch (e) {
      setError(e.message);
    }
  }
  return createPortal(
    <Modal title="Receipt preview" onClose={onClose}>
      <style>{`@media print { @page { size: auto; margin: 3mm; } .receipt { width: ${Number(r.width) - 6}mm !important; } }`}</style>
      <div className="receipt" style={{ maxWidth: `${r.width}mm` }}>
        <header>
          <h2>{r.name}</h2>
          {r.address && <p>{r.address}</p>}
          {r.registration && <p>{r.registration}</p>}
          <h3>
            {bill.test
              ? "TEST RECEIPT"
              : bill.status === "Cancelled"
                ? "CANCELLED BILL"
                : copy
                  ? "COPY RECEIPT"
                  : "RECEIPT"}
          </h3>
        </header>
        <div className="receipt-meta">
          <span>{bill.reference}</span>
          <span>{when(bill.createdAt)}</span>
          <span>Cashier: {v.cashier}</span>
          {v.name && <span>Customer: {v.name}</span>}
          {v.phone && <span>Phone: {v.phone}</span>}
          {v.reference && <span>Reference: {v.reference}</span>}
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {v.items.map((i, n) => (
              <tr key={n}>
                <td>{i.name}</td>
                <td>{i.quantity}</td>
                <td>{(i.price / 100).toFixed(2)}</td>
                <td>{(i.total / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="receipt-totals">
          <div>
            <span>Subtotal</span>
            <span>{money(v.subtotal)}</span>
          </div>
          {v.discount > 0 && (
            <div>
              <span>Discount</span>
              <span>−{money(v.discount)}</span>
            </div>
          )}
          {v.charge > 0 && (
            <div>
              <span>Charges ({r.serviceRate}%)</span>
              <span>{money(v.charge)}</span>
            </div>
          )}
          {v.tax > 0 && (
            <div>
              <span>Tax ({r.taxRate}%)</span>
              <span>{money(v.tax)}</span>
            </div>
          )}
          <div className="receipt-total">
            <strong>Total</strong>
            <strong>{money(v.total)}</strong>
          </div>
          <div>
            <span>Payment</span>
            <span>{v.payment}</span>
          </div>
          {v.payment === "Cash" && (
            <>
              <div>
                <span>Received</span>
                <span>{money(v.received)}</span>
              </div>
              <div>
                <span>Change</span>
                <span>{money(v.change)}</span>
              </div>
            </>
          )}
        </div>
        {bill.cancelReason && <p>Cancellation: {bill.cancelReason}</p>}
        <footer>{r.footer}</footer>
      </div>
      <div className="no-print stack">
        <ErrorBox error={error} />
        <div className="notice">
          <Info size={17} />
          <p>
            Choose your receipt printer, or select “Save as PDF” in the browser
            print dialog.
          </p>
        </div>
        <Button onClick={print}>
          <Printer size={17} />
          Print / save PDF
        </Button>
      </div>
    </Modal>,
    document.body,
  );
}
export function POS() {
  const { user } = useApp();
  const menu = useLoad("/catalog/menu"),
    settings = useLoad("/settings");
  const [category, setCategory] = useState("All items"),
    [search, setSearch] = useState(""),
    [cart, setCart] = useState([]),
    [customer, setCustomer] = useState({ name: "", phone: "", reference: "" }),
    [payment, setPayment] = useState("Cash"),
    [discount, setDiscount] = useState(""),
    [received, setReceived] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [receipt, setReceipt] = useState(null),
    [draft, setDraft] = useState(null);
  const idem = useRef(crypto.randomUUID());
  useEffect(() => {
    api("/draft")
      .then(setDraft)
      .catch((e) => setError(e.message));
  }, []);
  const s = settings.data || {},
    categories = [
      "All items",
      ...new Set((menu.data || []).map((i) => i.category)),
    ];
  const subtotal = cart.reduce((a, i) => a + i.price * i.quantity, 0),
    d = Math.round(Number(discount || 0) * 100),
    net = Math.max(subtotal - d, 0),
    tax = Math.round((net * (s.taxRate || 0)) / 100),
    charge = Math.round((net * (s.serviceRate || 0)) / 100),
    total = net + tax + charge;
  function add(item) {
    setNotice("");
    setCart((c) =>
      c.some((i) => i.id === item.id)
        ? c.map((i) =>
            i.id === item.id
              ? { ...i, quantity: Math.min(100, i.quantity + 1) }
              : i,
          )
        : [...c, { ...item, quantity: 1 }],
    );
  }
  function quantity(id, delta) {
    setCart((c) =>
      c
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    );
  }
  async function saveDraft() {
    setBusy(true);
    setError("");
    try {
      await send(
        "/draft",
        { cart, customer, payment, discount, received },
        "PUT",
      );
      setNotice("Draft saved. You can safely return to it later.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function finalise(e) {
    e.preventDefault();
    setError("");
    if (!cart.length) {
      setError("Add at least one menu item.");
      return;
    }
    setBusy(true);
    try {
      const bill = await send("/bills", {
        items: cart.map((i) => ({ id: i.id, quantity: i.quantity })),
        ...customer,
        discount: d,
        payment,
        received: received === "" ? total : Math.round(Number(received) * 100),
        idempotency: idem.current,
      });
      setReceipt(bill);
      setCart([]);
      setCustomer({ name: "", phone: "", reference: "" });
      setDiscount("");
      setReceived("");
      setDraft(null);
      idem.current = crypto.randomUUID();
      setNotice(`${bill.reference} saved. Printing is available below.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="RESTAURANT WORKSPACE"
        title="Create a bill"
        description="Select items, review the total, and print your receipt."
      >
        <Link className="btn secondary" to="/admin/bills">
          <ReceiptText size={16} />
          Bill history
        </Link>
      </Heading>
      <ErrorBox error={menu.error || settings.error} />
      {draft && (
        <div className="draft-notice">
          <Save size={17} />
          <span>You have a saved draft.</span>
          <button
            onClick={() => {
              setCart(draft.cart || []);
              setCustomer(draft.customer || {});
              setPayment(draft.payment || "Cash");
              setDiscount(draft.discount || "");
              setReceived(draft.received || "");
              setDraft(null);
            }}
          >
            Restore draft
          </button>
          <button onClick={() => setDraft(null)}>Dismiss</button>
        </div>
      )}
      <div className="pos-layout">
        <section className="panel menu-panel">
          <div className="menu-toolbar">
            <div>
              <h2>{s.restaurant || "Menu"}</h2>
              <small>
                {(menu.data || []).filter((i) => i.active).length} available
                items
              </small>
            </div>
            <div className="search-input">
              <Search size={16} />
              <input
                aria-label="Search menu"
                placeholder="Search menu items…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="category-tabs">
            {categories.map((c) => (
              <button
                key={c}
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="menu-grid">
            {(menu.data || [])
              .filter(
                (i) =>
                  i.active &&
                  (category === "All items" || i.category === category) &&
                  i.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((i) => (
                <button
                  className="menu-item"
                  key={i.id}
                  onClick={() => add(i)}
                  disabled={busy}
                >
                  <span className="veg-dot" />
                  <small>{i.category}</small>
                  <strong>{i.name}</strong>
                  <div>
                    <span>{money(i.price)}</span>
                    <span className="add-item">
                      <Plus size={16} />
                    </span>
                  </div>
                </button>
              ))}
          </div>
          {menu.data &&
            !menu.data.filter(
              (i) =>
                i.active &&
                (category === "All items" || i.category === category) &&
                i.name.toLowerCase().includes(search.toLowerCase()),
            ).length && (
              <Empty
                title="No items found"
                text="Try a different name or category."
              />
            )}
        </section>
        <form className="panel bill-panel" onSubmit={finalise}>
          <div className="bill-heading">
            <span className="soft-icon">
              <ReceiptText size={20} />
            </span>
            <div>
              <h2>Current bill</h2>
              <small>
                {cart.reduce((a, i) => a + i.quantity, 0)} items selected
              </small>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Clear bill"
              disabled={busy}
              onClick={() => {
                if (cart.length && confirm("Clear the current unsaved bill?"))
                  setCart([]);
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="cart-items">
            {cart.length ? (
              cart.map((i) => (
                <div className="cart-item" key={i.id}>
                  <div>
                    <strong>{i.name}</strong>
                    <small>{money(i.price)} each</small>
                  </div>
                  <div className="quantity">
                    <button
                      type="button"
                      aria-label={`Remove one ${i.name}`}
                      onClick={() => quantity(i.id, -1)}
                      disabled={busy}
                    >
                      <Minus size={13} />
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Add one ${i.name}`}
                      onClick={() => quantity(i.id, 1)}
                      disabled={busy || i.quantity >= 100}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <strong>{money(i.price * i.quantity)}</strong>
                </div>
              ))
            ) : (
              <Empty
                title="Your bill starts here"
                text="Select menu items to add them."
              />
            )}
          </div>
          <div className="bill-details">
            <details>
              <summary>
                Customer details <span>Optional</span>
              </summary>
              <div className="stack">
                <Field
                  label="Customer name"
                  maxLength={100}
                  value={customer.name || ""}
                  onChange={(e) =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                />
                <Field
                  label="Phone number"
                  type="tel"
                  maxLength={25}
                  value={customer.phone || ""}
                  onChange={(e) =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                />
                <Field
                  label="Reference / table"
                  maxLength={100}
                  value={customer.reference || ""}
                  onChange={(e) =>
                    setCustomer({ ...customer, reference: e.target.value })
                  }
                />
              </div>
            </details>
            <div className="bill-total-row">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {user.role !== "cashier" && (
              <div className="bill-total-row">
                <label htmlFor="discount">Discount (₹)</label>
                <input
                  id="discount"
                  className="amount-input"
                  type="number"
                  min="0"
                  max={subtotal / 100}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0.00"
                  disabled={busy}
                />
              </div>
            )}
            {charge > 0 && (
              <div className="bill-total-row">
                <span>Charges ({s.serviceRate}%)</span>
                <span>{money(charge)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="bill-total-row">
                <span>Tax ({s.taxRate}%)</span>
                <span>{money(tax)}</span>
              </div>
            )}
            <div className="bill-grand-total">
              <strong>Total payable</strong>
              <strong>{money(total)}</strong>
            </div>
            <div className="payment-options">
              {["Cash", "UPI", "Card"].map((p) => (
                <button
                  type="button"
                  key={p}
                  className={payment === p ? "active" : ""}
                  onClick={() => setPayment(p)}
                  disabled={busy}
                >
                  {payment === p && <Check size={14} />} {p}
                </button>
              ))}
            </div>
            {payment === "Cash" && (
              <Field
                label="Cash received (₹)"
                hint={
                  received !== ""
                    ? `Change: ${money(Math.max(0, Math.round(Number(received) * 100) - total))}`
                    : "Leave blank for exact payment."
                }
                type="number"
                min={total / 100}
                step="0.01"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                placeholder={(total / 100).toFixed(2)}
                disabled={busy}
              />
            )}
            <ErrorBox error={error} />
            {notice && (
              <div className="success-message" role="status">
                <CheckCircle2 size={16} />
                {notice}
              </div>
            )}
            <Button
              type="submit"
              busy={busy}
              disabled={!cart.length || !settings.data}
            >
              <CheckCircle2 size={17} />
              Finalise bill
            </Button>
            <Button
              type="button"
              variant="secondary"
              busy={busy}
              onClick={saveDraft}
              disabled={!cart.length}
            >
              <Save size={16} />
              Save draft
            </Button>
            <small className="bill-footnote">
              Payment method is recorded manually. Print after saving.
            </small>
          </div>
        </form>
      </div>
      {receipt && <Receipt bill={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

export function Bills() {
  const { user } = useApp(),
    load = useLoad("/bills");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("All"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [receipt, setReceipt] = useState(null),
    [cancel, setCancel] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = (load.data || []).filter(
      (b) =>
        `${b.reference} ${b.value.name} ${b.value.phone}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (status === "All" || b.status === status) &&
        (!from || businessDay(b.createdAt) >= from) &&
        (!to || businessDay(b.createdAt) <= to),
    ),
    sales = rows.filter((b) => b.status !== "Cancelled");
  const total = sales.reduce((a, b) => a + b.value.total, 0);
  const itemSales = {};
  sales.forEach((b) =>
    b.value.items.forEach((i) => {
      itemSales[i.name] = (itemSales[i.name] || 0) + i.quantity;
    }),
  );
  async function cancelBill(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await send(
        `/bills/${cancel.id}/cancel`,
        { reason: new FormData(e.currentTarget).get("reason") },
        "PATCH",
      );
      setCancel(null);
      load.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Bill history"
        description="Every bill, preserved exactly as it was issued."
      >
        <Link className="btn" to="/admin/pos">
          <Plus size={16} />
          New bill
        </Link>
      </Heading>
      <div className="metric-grid compact">
        <div className="metric-card">
          <span>Sales in view</span>
          <strong>{money(total)}</strong>
          <small>{sales.length} active bills</small>
        </div>
        <div className="metric-card">
          <span>Average bill</span>
          <strong>
            {money(sales.length ? Math.round(total / sales.length) : 0)}
          </strong>
          <small>Cancelled bills excluded</small>
        </div>
        <div className="metric-card">
          <span>Payment breakdown</span>
          <div className="payment-summary">
            {["Cash", "UPI", "Card"].map((p) => (
              <span key={p}>
                {p}
                <b>
                  {money(
                    sales
                      .filter((b) => b.value.payment === p)
                      .reduce((a, b) => a + b.value.total, 0),
                  )}
                </b>
              </span>
            ))}
          </div>
        </div>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search bills"
              placeholder="Bill number, customer or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Bill status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>All</option>
            <option>Finalised</option>
            <option>Cancelled</option>
          </select>
          <input
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            aria-label="To date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() =>
              csv("bills.csv", [
                [
                  "Bill",
                  "Date",
                  "Customer",
                  "Cashier",
                  "Total INR",
                  "Method",
                  "Status",
                ],
                ...rows.map((b) => [
                  b.reference,
                  when(b.createdAt),
                  b.value.name,
                  b.value.cashier,
                  b.value.total / 100,
                  b.value.payment,
                  b.status,
                ]),
              ])
            }
          >
            <Download size={16} />
            Export
          </Button>
        </div>
        <ErrorBox error={load.error} />
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.reference}</strong>
                    <small>{when(b.createdAt)}</small>
                  </td>
                  <td>
                    {b.value.name || "Walk-in customer"}
                    <small>{b.value.cashier}</small>
                  </td>
                  <td className="numeric">{money(b.value.total)}</td>
                  <td>{b.value.payment}</td>
                  <td>
                    <Badge status={b.status} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => setReceipt(b)}>
                        <Printer size={15} />
                        Reprint
                      </button>
                      {user.role !== "cashier" && b.status !== "Cancelled" && (
                        <button
                          className="danger-text"
                          onClick={() => {
                            setCancel(b);
                            setError("");
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="No bills found"
            text="Create a bill or adjust your filters."
          />
        )}
        <div className="table-footer">
          {rows.length} records · Latest 1,000 bills
        </div>
      </section>
      {Object.keys(itemSales).length > 0 && (
        <section className="panel item-report">
          <div className="panel-heading">
            <h2>Item sales in view</h2>
            <Button
              variant="secondary"
              onClick={() =>
                csv("item-sales.csv", [
                  ["Item", "Quantity"],
                  ...Object.entries(itemSales),
                ])
              }
            >
              <Download size={15} />
              Export items
            </Button>
          </div>
          <div className="item-sales">
            {Object.entries(itemSales)
              .sort((a, b) => b[1] - a[1])
              .map(([n, q]) => (
                <span key={n}>
                  {n}
                  <b>{q}</b>
                </span>
              ))}
          </div>
        </section>
      )}
      {receipt && (
        <Receipt bill={receipt} copy onClose={() => setReceipt(null)} />
      )}
      {cancel && (
        <Modal
          title={`Cancel ${cancel.reference}`}
          onClose={() => setCancel(null)}
        >
          <form className="stack" onSubmit={cancelBill}>
            <div className="notice">
              <Info size={18} />
              <p>
                The bill will remain in history and be excluded from active
                sales.
              </p>
            </div>
            <Field label="Reason *">
              <textarea name="reason" required maxLength={500} rows={3} />
            </Field>
            <ErrorBox error={error} />
            <Button variant="danger" busy={busy} type="submit">
              Cancel bill
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function businessDay(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export function Requests({ kind }) {
  useEffect(() => {
    setSearch("");
    setStatus("All");
    setFrom("");
    setTo("");
    setSelection(null);
    setManual(false);
  }, [kind]);
  const load = useLoad(`/requests/${kind}`),
    users = useLoad("/users");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("All"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [selection, setSelection] = useState(null),
    [manual, setManual] = useState(false);
  const options = kind === "hotel" ? hotelStatuses : legalStatuses;
  const rows = (load.data || []).filter(
    (r) =>
      `${r.reference} ${r.value.name} ${r.value.phone} ${r.value.serviceName || r.value.roomName}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "All" || r.status === status) &&
      (!from || businessDay(r.createdAt) >= from) &&
      (!to || businessDay(r.createdAt) <= to),
  );
  const h = kind === "hotel";
  return (
    <>
      <Heading
        eyebrow={h ? "STAYS & RESERVATIONS" : "CLIENT ASSISTANCE"}
        title={h ? "Hotel requests" : "Legal enquiries"}
        description={
          h
            ? "Review dates, check availability, and personally confirm each stay."
            : "Keep every enquiry and follow-up in one place."
        }
      >
        <Button onClick={() => setManual(true)}>
          <Plus size={16} />
          Add {h ? "request" : "enquiry"}
        </Button>
      </Heading>
      <div className="request-summary">
        <span>
          <i className="dot blue" />
          <strong>
            {(load.data || []).filter((r) => r.status === "New").length}
          </strong>{" "}
          new
        </span>
        <span>
          <i className="dot amber" />
          <strong>
            {
              (load.data || []).filter((r) =>
                [
                  "Contacted",
                  "Awaiting response",
                  "Assigned",
                  "Awaiting information",
                ].includes(r.status),
              ).length
            }
          </strong>{" "}
          in follow-up
        </span>
        <span>
          <i className="dot green" />
          <strong>
            {
              (load.data || []).filter((r) =>
                h ? r.status === "Confirmed" : r.status === "Closed",
              ).length
            }
          </strong>{" "}
          {h ? "confirmed" : "closed"}
        </span>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search requests"
              placeholder="Reference, name, phone or service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="All">All statuses</option>
            {options.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() =>
              csv(`${kind}-requests.csv`, [
                [
                  "Reference",
                  "Name",
                  "Phone",
                  "Email",
                  "Service / room",
                  "Status",
                  "Created",
                  "Arrival",
                  "Departure",
                ],
                ...rows.map((r) => [
                  r.reference,
                  r.value.name,
                  r.value.phone,
                  r.value.email,
                  r.value.roomName || r.value.serviceName,
                  r.status,
                  when(r.createdAt),
                  r.value.checkIn || "",
                  r.value.checkOut || "",
                ]),
              ])
            }
          >
            <Download size={16} />
            Export
          </Button>
        </div>
        <ErrorBox error={load.error} />
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>{h ? "Guest" : "Client"}</th>
                <th>{h ? "Stay details" : "Service"}</th>
                <th>Assigned to</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.reference}</strong>
                    <small>{when(r.createdAt)}</small>
                  </td>
                  <td>
                    {r.value.name}
                    <small>{r.value.phone}</small>
                  </td>
                  <td>
                    {r.value.roomName || r.value.serviceName}
                    <small>
                      {h
                        ? `${r.value.checkIn} → ${r.value.checkOut}`
                        : r.value.location}
                    </small>
                    {r.value.followUp && (
                      <small>Follow up: {r.value.followUp}</small>
                    )}
                  </td>
                  <td>
                    {users.data?.find((u) => u.id === r.assignee)?.name ||
                      "Unassigned"}
                  </td>
                  <td>
                    <Badge status={r.status} />
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setSelection(r)}
                    >
                      View <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="No requests found"
            text="New submissions will appear here. You can also add one manually."
          />
        )}
        <div className="table-footer">
          {rows.length} records · Latest 1,000 requests
        </div>
      </section>
      {h && (
        <section className="panel item-report">
          <div className="panel-heading">
            <h2>Upcoming confirmed stays</h2>
          </div>
          <div className="arrival-list">
            {(load.data || [])
              .filter(
                (r) =>
                  ["Confirmed", "Checked in"].includes(r.status) &&
                  r.value.checkOut >= businessDate(),
              )
              .sort((a, b) => a.value.checkIn.localeCompare(b.value.checkIn))
              .map((r) => (
                <button key={r.id} onClick={() => setSelection(r)}>
                  <span className="soft-icon">
                    <CalendarDays size={18} />
                  </span>
                  <strong>{r.value.name}</strong>
                  <span>{r.value.roomName}</span>
                  <small>
                    {r.value.checkIn} → {r.value.checkOut}
                  </small>
                </button>
              ))}
            {!(load.data || []).some(
              (r) =>
                ["Confirmed", "Checked in"].includes(r.status) &&
                r.value.checkOut >= businessDate(),
            ) && <p className="muted padded">No upcoming confirmed stays.</p>}
          </div>
        </section>
      )}
      {selection && (
        <RequestDetail
          request={selection}
          users={users.data || []}
          onClose={() => setSelection(null)}
          onSave={() => load.reload()}
        />
      )}
      {manual && (
        <ManualRequest
          kind={kind}
          onClose={() => setManual(false)}
          onSave={() => {
            setManual(false);
            load.reload();
          }}
        />
      )}
    </>
  );
}
function RequestDetail({ request, users, onClose, onSave }) {
  const [state, setState] = useState(request),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    activity = useLoad(`/activity/request/${request.id}`);
  const h = state.kind === "hotel",
    v = state.value;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (h) f.rate = f.rate === "" ? undefined : Number(f.rate);
    try {
      const r = await send(`/requests/${state.id}`, f, "PATCH");
      setState(r);
      e.target.elements.note.value = "";
      activity.reload();
      onSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={state.reference} wide onClose={onClose}>
      <div className="detail-grid">
        <div>
          <div className="detail-identity">
            <span className="avatar large">
              {v.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2>{v.name}</h2>
              <Badge status={state.status} />
            </div>
          </div>
          <dl className="details-list">
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${v.phone}`}>{v.phone}</a>
            </dd>
            <dt>Email</dt>
            <dd>{v.email || "Not provided"}</dd>
            <dt>{h ? "Room" : "Service"}</dt>
            <dd>{v.roomName || v.serviceName}</dd>
            {h ? (
              <>
                <dt>Stay dates</dt>
                <dd>
                  {v.checkIn} → {v.checkOut}
                </dd>
                <dt>Guests / rooms</dt>
                <dd>
                  {v.adults} adults, {v.children} children · {v.rooms} rooms
                </dd>
              </>
            ) : (
              <>
                <dt>Location</dt>
                <dd>{v.location}</dd>
                {Object.entries(v.answers || {}).map(([k, a]) => (
                  <React.Fragment key={k}>
                    <dt>{k}</dt>
                    <dd>{a || "Not provided"}</dd>
                  </React.Fragment>
                ))}
              </>
            )}
            <dt>Submitted</dt>
            <dd>{when(state.createdAt)}</dd>
          </dl>
          <h3>{h ? "Special requests" : "Requirement"}</h3>
          <p className="preserve">{v.message || "No additional details."}</p>
          <h3>Activity & notes</h3>
          <ErrorBox error={activity.error} />
          <div className="activity-list">
            {activity.data?.length ? (
              activity.data.map((a) => (
                <div key={a.id}>
                  <span />
                  <p>
                    {a.action}
                    <small>
                      {a.actor} · {when(a.createdAt)}
                    </small>
                  </p>
                </div>
              ))
            ) : (
              <p className="muted">No staff activity recorded yet.</p>
            )}
          </div>
        </div>
        <form className="stack detail-edit" onSubmit={submit}>
          {h && (
            <div className="notice">
              <Info size={18} />
              <p>
                Verify availability manually before marking this request
                Confirmed.
              </p>
            </div>
          )}
          <Field label="Status">
            <select name="status" defaultValue={state.status}>
              {(h ? hotelStatuses : legalStatuses).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Assigned to">
            <select name="assignee" defaultValue={state.assignee || ""}>
              <option value="">Unassigned</option>
              {users
                .filter(
                  (u) => u.active && ["owner", state.kind].includes(u.role),
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </Field>
          {h && (
            <Field
              label="Agreed nightly rate (₹)"
              name="rate"
              type="number"
              min="0"
              step="0.01"
              defaultValue={v.rate ?? ""}
            />
          )}
          <Field
            label="Follow-up date"
            name="followUp"
            type="date"
            defaultValue={v.followUp || ""}
          />
          <Field label="Internal note / contact attempt">
            <textarea name="note" rows={4} maxLength={2000} />
          </Field>
          <ErrorBox error={error} />
          <Button type="submit" busy={busy}>
            <Save size={16} />
            Save changes
          </Button>
        </form>
      </div>
    </Modal>
  );
}
function ManualRequest({ kind, onClose, onSave }) {
  const { pub } = useApp(),
    h = kind === "hotel",
    catalog = h ? pub.rooms : pub.services;
  const [selected, setSelected] = useState(catalog[0]?.id || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const idem = useRef(crypto.randomUUID()),
    item = catalog.find((x) => x.id === selected);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const answers = {};
    if (!h)
      item.fields.forEach((q, i) => {
        answers[q.name] = f[`q-${i}`] || "";
        delete f[`q-${i}`];
      });
    try {
      await send("/public/requests", {
        ...f,
        kind,
        idempotency: idem.current,
        ...(h
          ? {
              roomId: selected,
              adults: Number(f.adults),
              children: Number(f.children),
              rooms: Number(f.rooms),
            }
          : { serviceId: selected, answers }),
      });
      onSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Add ${h ? "hotel request" : "legal enquiry"}`}
      onClose={onClose}
    >
      <form className="stack" onSubmit={submit}>
        <Field label={h ? "Room type" : "Service"}>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {catalog.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name *" name="name" maxLength={100} required />
        <Field
          label="Phone *"
          name="phone"
          type="tel"
          required
          maxLength={25}
        />
        <Field label="Email" name="email" type="email" maxLength={180} />
        {h ? (
          <>
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
          </>
        ) : (
          <>
            <Field
              label="Location *"
              name="location"
              required
              maxLength={200}
            />
            {item?.fields.map((q, i) => (
              <Field
                key={q.name}
                label={q.name + (q.required ? " *" : "")}
                name={`q-${i}`}
                maxLength={500}
                required={q.required}
              />
            ))}
          </>
        )}
        <Field label={h ? "Special requests" : "Requirement *"}>
          <textarea name="message" maxLength={3000} required={!h} rows={3} />
        </Field>
        <ErrorBox error={error} />
        <Button busy={busy} type="submit" disabled={!item}>
          Add request
        </Button>
      </form>
    </Modal>
  );
}

export function Catalog({ kind }) {
  useEffect(() => {
    setEdit(null);
    setSearch("");
    setError("");
  }, [kind]);
  const load = useLoad(`/catalog/${kind}`),
    { refreshPublic } = useApp();
  const [search, setSearch] = useState(""),
    [edit, setEdit] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const name =
      kind === "menu"
        ? "Menu items"
        : kind === "rooms"
          ? "Room types"
          : "Legal services",
    rows = (load.data || []).filter((x) =>
      `${x.name} ${x.category || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      f = Object.fromEntries(new FormData(form));
    f.active = form.elements.active.checked;
    if (kind === "menu") f.price = Math.round(Number(f.price) * 100);
    if (kind === "rooms") {
      f.price = Number(f.price);
      f.occupancy = Number(f.occupancy);
    }
    if (kind === "services") {
      f.fields = (f.questions || "")
        .split("\n")
        .map((q) => q.trim())
        .filter(Boolean)
        .map((q) => ({
          name: q.replace(/\*$/, "").trim(),
          required: q.endsWith("*"),
        }));
      delete f.questions;
    }
    try {
      await send(
        `/catalog/${kind}${edit.id ? "/" + edit.id : ""}`,
        f,
        edit.id ? "PATCH" : "POST",
      );
      await refreshPublic();
      setEdit(null);
      load.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title={name}
        description="Keep the information your team and customers rely on up to date."
      >
        <Button
          onClick={() => {
            setEdit({ active: true });
            setError("");
          }}
        >
          <Plus size={17} />
          Add{" "}
          {kind === "menu"
            ? "item"
            : kind === "rooms"
              ? "room type"
              : "service"}
        </Button>
      </Heading>
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label={`Search ${name}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
            />
          </div>
          <span className="muted">{rows.length} records</span>
        </div>
        <ErrorBox error={load.error} />
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>{kind === "rooms" ? "Occupancy" : "Category"}</th>
                <th>{kind === "services" ? "Form questions" : "Price"}</th>
                <th>Availability</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td>
                    <strong>{x.name}</strong>
                    {x.summary && <small>{x.summary}</small>}
                  </td>
                  <td>
                    {kind === "rooms" ? `${x.occupancy} guests` : x.category}
                  </td>
                  <td>
                    {kind === "services"
                      ? `${x.fields.length} questions`
                      : money(kind === "rooms" ? x.price * 100 : x.price)}
                  </td>
                  <td>
                    <Badge status={x.active ? "Active" : "Inactive"} />
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setEdit(x);
                        setError("");
                      }}
                    >
                      <Edit3 size={15} />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty />}
      </section>
      {edit && (
        <Modal
          title={`${edit.id ? "Edit" : "Add"} ${kind === "menu" ? "menu item" : kind === "rooms" ? "room type" : "legal service"}`}
          onClose={() => setEdit(null)}
        >
          <form className="stack" onSubmit={save}>
            <Field
              label="Name *"
              name="name"
              required
              maxLength={120}
              defaultValue={edit.name || ""}
            />
            {kind !== "rooms" && (
              <Field
                label="Category *"
                name="category"
                required
                maxLength={80}
                defaultValue={edit.category || ""}
              />
            )}
            {kind !== "services" && (
              <Field
                label={
                  kind === "rooms"
                    ? "Indicative price / night (₹) *"
                    : "Price (₹) *"
                }
                name="price"
                type="number"
                min="0"
                max={kind === "menu" ? 100000 : 1000000}
                step="0.01"
                required
                defaultValue={
                  edit.price !== undefined
                    ? kind === "menu"
                      ? edit.price / 100
                      : edit.price
                    : ""
                }
              />
            )}
            {kind === "rooms" && (
              <>
                <Field
                  label="Maximum guests / room *"
                  name="occupancy"
                  type="number"
                  min="1"
                  max="20"
                  required
                  defaultValue={edit.occupancy || 2}
                />
                <Field
                  label="Amenities (comma-separated)"
                  name="amenities"
                  maxLength={500}
                  defaultValue={edit.amenities || ""}
                />
                <Field
                  label="Room photo URL (HTTPS)"
                  name="imageUrl"
                  type="url"
                  maxLength={1000}
                  defaultValue={edit.imageUrl || ""}
                  placeholder="https://…"
                />
              </>
            )}
            {kind === "services" && (
              <Field
                label="Short summary *"
                name="summary"
                required
                maxLength={200}
                defaultValue={edit.summary || ""}
              />
            )}
            {kind !== "menu" && (
              <Field label="Description *">
                <textarea
                  name="description"
                  required
                  maxLength={3000}
                  rows={4}
                  defaultValue={edit.description || ""}
                />
              </Field>
            )}
            {kind === "services" && (
              <Field
                label="Service-specific questions"
                hint="One question per line, up to 8. End a question with * to make it required."
              >
                <textarea
                  name="questions"
                  rows={5}
                  defaultValue={
                    edit.fields
                      ?.map((q) => q.name + (q.required ? "*" : ""))
                      .join("\n") || ""
                  }
                />
              </Field>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="active"
                defaultChecked={edit.active}
              />
              Available to customers / cashiers
            </label>
            <ErrorBox error={error} />
            <Button busy={busy} type="submit">
              <Save size={16} />
              Save{" "}
              {kind === "menu" ? "item" : kind === "rooms" ? "room" : "service"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function Settings() {
  const [testReceipt, setTestReceipt] = useState(null);
  const load = useLoad("/settings"),
    { refreshPublic, user } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (f.taxRate !== undefined) f.taxRate = Number(f.taxRate);
    if (f.serviceRate !== undefined) f.serviceRate = Number(f.serviceRate);
    try {
      const s = await send("/settings", f, "PATCH");
      load.setData(s);
      await refreshPublic();
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const s = load.data;
  return (
    <>
      <Heading
        title="Business settings"
        description="The details that make this workspace yours."
      >
        {s && ["owner", "restaurant"].includes(user.role) && (
          <Button
            variant="secondary"
            onClick={() =>
              setTestReceipt({
                test: true,
                reference: "TEST-RECEIPT",
                createdAt: new Date().toISOString(),
                value: {
                  items: [
                    {
                      name: "Sample item with a longer name",
                      quantity: 2,
                      price: 10000,
                      total: 20000,
                    },
                  ],
                  subtotal: 20000,
                  discount: 0,
                  tax: 0,
                  charge: 0,
                  total: 20000,
                  received: 20000,
                  change: 0,
                  payment: "Cash",
                  cashier: "Printer test",
                  receipt: {
                    name: s.restaurant,
                    address: s.receiptAddress,
                    registration: s.receiptRegistration,
                    footer: s.receiptFooter,
                    width: s.receiptWidth,
                    taxRate: 0,
                    serviceRate: 0,
                  },
                },
              })
            }
          >
            <Printer size={16} />
            Test receipt
          </Button>
        )}
      </Heading>
      <ErrorBox error={load.error} />
      {s && (
        <form className="settings-form" onSubmit={save}>
          {user.role === "owner" && (
            <section className="panel settings-section">
              <div>
                <span className="soft-icon">
                  <Settings2 size={21} />
                </span>
                <h2>Business & portal</h2>
                <p>
                  Public branding and contact details. Path Lab is available at
                  /pathlab/.
                </p>
              </div>
              <div className="stack">
                <Field
                  label="Business name *"
                  name="brand"
                  defaultValue={s.brand}
                  maxLength={100}
                  required
                />
                <Field
                  label="Tagline"
                  name="tagline"
                  defaultValue={s.tagline}
                  maxLength={500}
                />
                <Field label="Homepage introduction">
                  <textarea
                    name="intro"
                    defaultValue={s.intro}
                    rows={3}
                    maxLength={3000}
                  />
                </Field>
                <div className="form-grid">
                  <Field
                    label="Contact phone"
                    name="phone"
                    type="tel"
                    defaultValue={s.phone}
                    maxLength={500}
                  />
                  <Field
                    label="Contact email"
                    name="email"
                    type="email"
                    defaultValue={s.email}
                    maxLength={500}
                  />
                </div>
                <Field
                  label="Address"
                  name="address"
                  defaultValue={s.address}
                  maxLength={500}
                />
                <div className="notice">
                  <Info size={17} />
                  <p>
                    Path Lab is included at <a href="/pathlab/">/pathlab/</a>,
                    with its own existing login.
                  </p>
                </div>
              </div>
            </section>
          )}
          {["owner", "restaurant"].includes(user.role) && (
            <section className="panel settings-section">
              <div>
                <span className="soft-icon">
                  <ReceiptText size={21} />
                </span>
                <h2>Restaurant & receipts</h2>
                <p>
                  Changes apply to new bills. Previously issued bills keep their
                  original details.
                </p>
              </div>
              <div className="stack">
                <Field
                  label="Restaurant name *"
                  name="restaurant"
                  defaultValue={s.restaurant}
                  maxLength={100}
                  required
                />
                <Field
                  label="Receipt address"
                  name="receiptAddress"
                  defaultValue={s.receiptAddress}
                  maxLength={500}
                />
                <Field
                  label="Registration details"
                  name="receiptRegistration"
                  defaultValue={s.receiptRegistration}
                  maxLength={500}
                />
                <Field
                  label="Receipt footer"
                  name="receiptFooter"
                  defaultValue={s.receiptFooter}
                  maxLength={500}
                />
                <Field label="Paper width">
                  <select name="receiptWidth" defaultValue={s.receiptWidth}>
                    <option value="80">80 mm</option>
                    <option value="58">58 mm</option>
                  </select>
                </Field>
                <div className="form-grid">
                  <Field
                    label="Tax rate (%)"
                    name="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={s.taxRate}
                    required
                  />
                  <Field
                    label="Additional charge (%)"
                    name="serviceRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={s.serviceRate}
                    required
                  />
                </div>
                <small className="muted">
                  Both percentages apply to the subtotal after discount. Amounts
                  are rounded to the nearest paise. Use client-approved rates.
                </small>
              </div>
            </section>
          )}
          {["owner", "hotel"].includes(user.role) && (
            <section className="panel settings-section">
              <div>
                <span className="soft-icon">
                  <BedDouble size={21} />
                </span>
                <h2>Hotel profile</h2>
                <p>The information guests see before sending a request.</p>
              </div>
              <div className="stack">
                <Field
                  label="Hotel name"
                  name="hotelName"
                  defaultValue={s.hotelName}
                  maxLength={500}
                />
                <Field
                  label="Location"
                  name="hotelLocation"
                  defaultValue={s.hotelLocation}
                  maxLength={500}
                />
                <Field label="Introduction">
                  <textarea
                    name="hotelDescription"
                    defaultValue={s.hotelDescription}
                    rows={4}
                    maxLength={3000}
                  />
                </Field>
                <Field
                  label="Amenities (comma-separated)"
                  name="hotelAmenities"
                  defaultValue={s.hotelAmenities}
                  maxLength={500}
                />
                <Field label="Booking policies">
                  <textarea
                    name="hotelPolicies"
                    defaultValue={s.hotelPolicies}
                    rows={4}
                    maxLength={3000}
                  />
                </Field>
              </div>
            </section>
          )}
          <div className="settings-save">
            <ErrorBox error={error} />
            {saved && (
              <span className="success-message" role="status">
                <CheckCircle2 size={17} />
                Settings saved
              </span>
            )}
            <Button type="submit" busy={busy}>
              <Save size={16} />
              Save changes
            </Button>
          </div>
        </form>
      )}
      {testReceipt && (
        <Receipt bill={testReceipt} onClose={() => setTestReceipt(null)} />
      )}
    </>
  );
}
export function Staff() {
  const load = useLoad("/users"),
    [edit, setEdit] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (edit.id) delete f.name;
    try {
      await send(
        `/users${edit.id ? "/" + edit.id : ""}`,
        f,
        edit.id ? "PATCH" : "POST",
      );
      setEdit(null);
      load.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(u) {
    try {
      await send(`/users/${u.id}`, { active: !u.active }, "PATCH");
      load.reload();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <Heading
        title="Staff & access"
        description="The right access for every member of your team."
      >
        <Button
          onClick={() => {
            setEdit({});
            setError("");
          }}
        >
          <Plus size={17} />
          Add staff member
        </Button>
      </Heading>
      <ErrorBox error={load.error || error} />
      <section className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {load.data?.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                  </td>
                  <td>{u.email}</td>
                  <td className="capitalize">{u.role}</td>
                  <td>
                    <Badge status={u.active ? "Active" : "Inactive"} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => {
                          setEdit(u);
                          setError("");
                        }}
                      >
                        Reset password
                      </button>
                      {u.role !== "owner" && (
                        <button onClick={() => toggle(u)}>
                          {u.active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {edit && (
        <Modal
          title={edit.id ? `Reset password · ${edit.name}` : "Add staff member"}
          onClose={() => setEdit(null)}
        >
          <form className="stack" onSubmit={save}>
            {!edit.id && (
              <>
                <Field
                  label="Full name *"
                  name="name"
                  required
                  maxLength={100}
                />
                <Field
                  label="Email *"
                  name="email"
                  type="email"
                  required
                  maxLength={180}
                />
                <Field label="Role">
                  <select name="role">
                    <option value="cashier">Restaurant cashier</option>
                    <option value="restaurant">Restaurant administrator</option>
                    <option value="hotel">Hotel staff</option>
                    <option value="legal">Legal staff</option>
                  </select>
                </Field>
              </>
            )}
            <Field
              label="New password *"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={200}
              required
              hint="At least 12 characters. Share it securely with the staff member."
            />
            {edit.id && (
              <div className="notice">
                <Info size={17} />
                <p>
                  Existing sessions will be signed out, including your own
                  session if resetting the owner password.
                </p>
              </div>
            )}
            <ErrorBox error={error} />
            <Button type="submit" busy={busy}>
              {edit.id ? "Reset password" : "Create staff account"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
