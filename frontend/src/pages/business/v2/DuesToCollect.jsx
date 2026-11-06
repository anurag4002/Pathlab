import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Printer, RefreshCw } from 'lucide-react';
import { getBills, collectPayment } from '../../../services/billService';
import { getSummary } from '../../../services/dashboardService';
import { PAYMENT_METHODS } from '../../../constants/billConstants';
import { DEPARTMENTS } from '../../../features/billing/billingConstants';
import { PageHeader, Button, StatGroup, Modal, Input, Select, IdentityCell } from '../../../components/common';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport, { fetchAllPages } from '../../../utils/printReport';
import { money, dayLabel, sum, downloadCsv } from '../../../utils/reportFormat';
import { usePermissions } from '../../../hooks/usePermission';
import { notify } from '../../../components/common/Toast/toast';
import '../../../components/business/business.css';
import './businessPages.css';

const daysOld = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
const daysText = (n) => (n === 0 ? 'Today' : n === 1 ? '1 day' : `${n} days`);

// Dues to collect (new look): every bill with money still owed, oldest
// first, with a Collect button on each.
export default function DuesToCollect() {
  const [bills, setBills] = useState([]);
  const [totalDue, setTotalDue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');
  const [reload, setReload] = useState(0);
  const { can } = usePermissions();
  const canCollect = can('billing') || can('finance');

  // Collect payment
  const [target, setTarget] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    Promise.allSettled([
      fetchAllPages(async (p, size) => {
        const res = await getBills({ paymentStatus: 'Outstanding', page: p, limit: size });
        return { items: res?.data?.bills || [], pages: res?.data?.pagination?.pages || 1 };
      }),
      getSummary(),
    ]).then(([list, summary]) => {
      if (cancelled) return;
      if (list.status === 'fulfilled') setBills(list.value.filter((b) => b.paymentStatus !== 'Paid' && Number(b.dueAmount) > 0 && !b.isVoided && !b.cancelled));
      else { setBills([]); setError('Could not load the dues. Try again.'); }
      setTotalDue(summary.status === 'fulfilled' ? summary.value?.data?.pendingPayments ?? null : null);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const departments = useMemo(() => [...new Set([...DEPARTMENTS.map((d) => d.name), ...bills.map((b) => b.department).filter(Boolean)])]
    .filter((name) => bills.some((b) => String(b.department || '').toUpperCase() === String(name).toUpperCase())), [bills]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills
      .filter((b) => !dept || String(b.department || '').toUpperCase() === dept.toUpperCase())
      .filter((b) => !q || [b.billNumber, b.patient?.name, b.patient?.phone, b.patient?.registrationNumber].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [bills, dept, search]);

  const listDue = sum(rows, (b) => b.dueAmount);
  const oldest = rows[0] ? daysOld(rows[0].date) : null;
  const filtered = !!(dept || search.trim());
  const shownTotal = filtered || totalDue == null ? listDue : totalDue;

  const openCollect = (bill) => { setTarget(bill); setAmount(String(bill.dueAmount)); setMethod('Cash'); setPayError(''); };
  const collect = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setPayError('Enter an amount more than 0.'); return; }
    if (amt > Number(target.dueAmount)) { setPayError(`This bill only has ${money(target.dueAmount)} left to pay.`); return; }
    if (!method) { setPayError('Choose how the patient paid.'); return; }
    setPayError(''); setPaying(true);
    try {
      const res = await collectPayment(target._id, { amount: amt, paymentMethod: method });
      if (res?.success) {
        notify(`${money(amt)} collected for bill ${target.billNumber}`);
        setTarget(null);
        setReload((n) => n + 1);
      }
    } catch (err) {
      setPayError(err.response?.data?.message || 'Could not record the payment. Try again.');
    } finally {
      setPaying(false);
    }
  };

  const print = () => printReport({
    title: 'Dues - money still to collect',
    period: `As on ${dayLabel(new Date().toLocaleDateString('en-CA'))}`,
    filters: [dept && `Department: ${dept}`, search && `Search: ${search}`],
    summary: [
      { label: 'Bills with a balance', value: String(rows.length) },
      { label: 'Billed', value: money(sum(rows, (b) => b.totalAmount)) },
      { label: 'Received', value: money(sum(rows, (b) => b.paidAmount)) },
      { label: 'Still to collect', value: money(listDue) },
    ],
    sections: [{
      columns: [{ label: 'Bill no' }, { label: 'Patient' }, { label: 'Phone' }, { label: 'Bill date' }, { label: 'Days', align: 'right' }, { label: 'Amount', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Still to collect', align: 'right' }],
      rows: rows.map((b) => [b.billNumber, b.patient?.name || 'Walk-in', b.patient?.phone || '', dayLabel(b.date), String(daysOld(b.date)), money(b.totalAmount), money(b.paidAmount), money(b.dueAmount)]),
      totals: ['Total', `${rows.length} bills`, '', '', '', money(sum(rows, (b) => b.totalAmount)), money(sum(rows, (b) => b.paidAmount)), money(listDue)],
      empty: 'Nothing to collect - every bill is paid.',
    }],
    note: 'Days = days since the bill was made. Oldest bills first.',
  });
  const downloadRows = () => downloadCsv('dues-to-collect.csv',
    ['Bill no', 'Patient', 'Phone', 'Bill date', 'Days pending', 'Amount', 'Received', 'Still to collect'],
    rows.map((b) => [b.billNumber, b.patient?.name || 'Walk-in', b.patient?.phone || '', dayLabel(b.date), daysOld(b.date), b.totalAmount, b.paidAmount, b.dueAmount]));

  return (
    <div className="biz-page">
      <PageHeader
        title="Dues to collect"
        subtitle="Bills that still have money to collect, oldest first."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReload((n) => n + 1)}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[{ label: 'This list (CSV)', onClick: downloadRows }]} />
          </div>
        }
      />

      {/* The search box is driven by the top-bar search; the row only shows
          when there is a department to choose. */}
      <div className={departments.length > 1 ? 'biz-filter-row' : undefined}>
        {departments.length > 1 && (
          <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <div className="form-group biz-inline-search">
          <input type="search" data-page-search="" aria-label="Search patient, phone or bill no" placeholder="Patient, phone or bill no" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} label="Dues summary" items={[
        { label: 'Total balance due', value: money(shownTotal), hint: filtered ? 'For this filter' : 'Same as the dashboard', tone: shownTotal > 0 ? 'danger' : undefined },
        { label: 'Bills with a balance', value: String(rows.length) },
        { label: 'Oldest unpaid bill', value: oldest == null ? 'None' : daysText(oldest), hint: rows[0] ? `Bill ${rows[0].billNumber}` : undefined, tone: oldest > 30 ? 'warning' : undefined },
      ]} />

      <ReportTable loading={loading} rows={rows}
        empty={filtered ? 'No dues match these filters.' : 'Nothing to collect - every bill is paid.'}
        columns={[
          { key: 'patient', label: 'Patient', render: (b) => <IdentityCell name={b.patient?.name || 'Walk-in'} meta={[b.patient?.phone && `+91 ${b.patient.phone}`]} /> },
          { key: 'bill', label: 'Bill', render: (b) => <><div className="strong">{b.billNumber}</div><div className="muted">{dayLabel(b.date)}</div></> },
          { key: 'days', label: 'Pending', render: (b) => { const n = daysOld(b.date); return <span className={`biz-days${n > 30 ? ' is-old' : ''}`}>{daysText(n)}</span>; } },
          { key: 'amount', label: 'Amount', align: 'right', render: (b) => money(b.totalAmount) },
          { key: 'paid', label: 'Received', align: 'right', render: (b) => money(b.paidAmount) },
          { key: 'due', label: 'Still to collect', align: 'right', render: (b) => <span className="is-due">{money(b.dueAmount)}</span> },
          { key: 'action', label: '', align: 'right', render: (b) => (canCollect
            ? <Button variant="primary" size="sm" icon={<CreditCard size={14} />} onClick={() => openCollect(b)} aria-label={`Collect for bill ${b.billNumber}`}>Collect</Button>
            : <span className="muted">No access</span>) },
        ]}
        totals={{ patient: 'Total', bill: `${rows.length} bills`, amount: money(sum(rows, (b) => b.totalAmount)), paid: money(sum(rows, (b) => b.paidAmount)), due: money(listDue) }} />

      <Modal isOpen={!!target} onClose={() => setTarget(null)} variant="drawer" title="Collect payment"
        footer={<>
          <Button variant="secondary" onClick={() => setTarget(null)} disabled={paying}>Cancel</Button>
          <Button variant="primary" onClick={collect} loading={paying}>Collect {amount ? money(amount) : ''}</Button>
        </>}>
        {target && (
          <form className="biz-form" onSubmit={(e) => { e.preventDefault(); collect(); }}>
            <dl className="biz-collect-sum">
              <dt>Patient</dt><dd>{target.patient?.name || 'Walk-in'}</dd>
              <dt>Bill</dt><dd>{target.billNumber} · {dayLabel(target.date)}</dd>
              <dt>Bill amount</dt><dd>{money(target.totalAmount)}</dd>
              <dt>Already received</dt><dd>{money(target.paidAmount)}</dd>
              <dt>Still to collect</dt><dd className="is-due">{money(target.dueAmount)}</dd>
            </dl>
            {payError && <div className="biz-form-error" role="alert">{payError}</div>}
            <Input label="Amount received now (₹)" type="number" inputMode="decimal" value={amount} autoFocus
              onChange={(e) => { const v = e.target.value; setAmount(v === '' ? '' : String(Math.max(0, Math.min(Number(v), Number(target.dueAmount))))); }} />
            <Select label="Paid by" value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} required />
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
        )}
      </Modal>
    </div>
  );
}
