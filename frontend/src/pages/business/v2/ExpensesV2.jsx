import React, { useEffect, useMemo, useState } from 'react';
import useStickyState from '../../../utils/useStickyState';
import { Plus, Printer, Tags } from 'lucide-react';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../../../services/expenseService';
import { EXPENSE_CATEGORIES } from '../../../constants/businessConstants';
import { PAYMENT_METHODS } from '../../../constants/billConstants';
import { PageHeader, Button, StatGroup, Modal, Input, Select, ConfirmDialog, RowMenu } from '../../../components/common';
import PeriodBar, { presetRange } from '../../../components/business/PeriodBar';
import DownloadMenu from '../../../components/business/DownloadMenu';
import ReportTable from '../../../components/business/ReportTable';
import printReport from '../../../utils/printReport';
import { money, dayLabel, periodLabel, sum, downloadCsv } from '../../../utils/reportFormat';
import { usePermissions } from '../../../hooks/usePermission';
import { notify } from '../../../components/common/Toast/toast';
import '../../../components/business/business.css';
import './businessPages.css';

const modeClass = (mode) => `biz-pill is-${String(mode || '').toLowerCase()}`;
const today = () => new Date().toLocaleDateString('en-CA');
const loadCats = () => { try { const saved = JSON.parse(localStorage.getItem('expense_cats') || 'null'); return Array.isArray(saved) && saved.length ? saved : null; } catch { return null; } };

// Expenses (new look): what the lab spent in a period, by category, with
// recording and editing in a side panel.
export default function ExpensesV2() {
  const [[from, to], setRange] = useStickyState('range', () => presetRange('month'));
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useStickyState('category', '');
  const [search, setSearch] = useStickyState('search', '');
  const [reload, setReload] = useState(0);
  const [cats, setCats] = useState(loadCats);
  const allCats = cats || EXPENSE_CATEGORIES;
  const { can } = usePermissions();
  const canFinance = can('finance');

  // Record / edit panel
  const [formOpen, setFormOpen] = useStickyState('formOpen', false);
  const [editing, setEditing] = useStickyState('editing', null);
  const [form, setForm] = useStickyState('form', {});
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Categories panel
  const [catOpen, setCatOpen] = useStickyState('catOpen', false);
  const [newCat, setNewCat] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getExpenses({ startDate: from, endDate: to })
      .then((res) => { if (!cancelled) setExpenses(res?.success ? res.data || [] : []); })
      .catch(() => { if (!cancelled) { setExpenses([]); setError('Could not load the expenses for this period.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, reload]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => (!category || e.category === category)
      && (!q || [e.category, e.name, e.description, e.notes].some((v) => String(v || '').toLowerCase().includes(q))));
  }, [expenses, category, search]);

  const spent = sum(rows, (e) => e.amount);
  const byCat = useMemo(() => Object.entries(rows.reduce((acc, e) => { const k = e.category || 'Other'; acc[k] = (acc[k] || 0) + (Number(e.amount) || 0); return acc; }, {}))
    .map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount), [rows]);
  const cash = sum(rows.filter((e) => e.paymentMethod === 'Cash'), (e) => e.amount);
  const catOptions = [...new Set([...allCats, ...expenses.map((e) => e.category).filter(Boolean)])];

  const saveCats = (list) => { setCats(list); try { localStorage.setItem('expense_cats', JSON.stringify(list)); } catch { /* ignore */ } };

  const openCreate = () => {
    // A half-typed new expense (closed by mistake) comes back as it was.
    if (!editing && form && (form.amount || form.name || form.description || form.notes)) { setFormErrors({}); setFormOpen(true); return; }
    setEditing(null);
    setForm({ category: allCats[0], amount: '', date: today(), paymentMethod: 'Cash', name: '', description: '', notes: '' });
    setFormErrors({});
    setFormOpen(true);
  };
  const openEdit = (exp) => {
    setEditing(exp);
    setForm({ category: exp.category, amount: String(exp.amount), date: exp.date ? String(exp.date).slice(0, 10) : today(), paymentMethod: exp.paymentMethod || 'Cash', name: exp.name || '', description: exp.description || '', notes: exp.notes || '' });
    setFormErrors({});
    setFormOpen(true);
  };
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const save = async (event) => {
    event?.preventDefault?.();
    const errs = {};
    if (!form.category) errs.category = 'Choose a category.';
    if (!form.amount || Number.isNaN(Number(form.amount)) || Number(form.amount) <= 0) errs.amount = 'Enter an amount more than 0.';
    if (!form.date) errs.date = 'Choose the date.';
    setFormErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      const res = editing ? await updateExpense(editing._id, payload) : await createExpense(payload);
      if (res?.success) {
        setFormOpen(false);
        setForm({}); setEditing(null);
        notify(editing ? 'Expense updated' : 'Expense recorded');
        setReload((n) => n + 1);
      }
    } catch (err) {
      setFormErrors({ api: err.response?.data?.message || 'Could not save the expense. Try again.' });
    } finally {
      setSaving(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteExpense(deleteTarget._id);
      if (res?.success) { setDeleteTarget(null); notify('Expense removed'); setReload((n) => n + 1); }
    } catch (err) {
      notify(err.response?.data?.message || 'Could not remove the expense.');
    } finally {
      setDeleting(false);
    }
  };

  const print = () => printReport({
    title: 'Expenses',
    period: periodLabel(from, to),
    filters: [category && `Category: ${category}`, search && `Search: ${search}`],
    summary: [
      { label: 'Spent', value: money(spent) },
      { label: 'Entries', value: String(rows.length) },
      { label: 'Paid in cash', value: money(cash) },
    ],
    sections: [
      byCat.length > 1 && {
        title: 'By category',
        columns: [{ label: 'Category' }, { label: 'Spent', align: 'right' }],
        rows: byCat.map((c) => [c.name, money(c.amount)]),
        totals: ['Total', money(spent)],
      },
      {
        title: 'All expenses',
        columns: [{ label: 'Date' }, { label: 'Category' }, { label: 'Details' }, { label: 'Paid by' }, { label: 'Amount', align: 'right' }],
        rows: rows.map((e) => [dayLabel(e.date), e.category || '', [e.name, e.description].filter(Boolean).join(' - '), e.paymentMethod || '', money(e.amount)]),
        totals: ['Total', `${rows.length} entries`, '', '', money(spent)],
        empty: 'No expenses for these filters.',
      },
    ],
  });
  const downloadRows = () => downloadCsv(`expenses-${from}-to-${to}.csv`,
    ['Date', 'Category', 'Spent on', 'Details', 'Notes', 'Paid by', 'Added by', 'Amount'],
    rows.map((e) => [dayLabel(e.date), e.category || '', e.name || '', e.description || '', e.notes || '', e.paymentMethod || '', e.addedBy?.name || '', e.amount]));

  const biggest = byCat[0];
  return (
    <div className="biz-page">
      <PageHeader
        title="Expenses"
        subtitle="What the lab spent in a period - rent, reagents, salaries and more."
        action={
          <div className="biz-actions">
            <Button variant="secondary" size="sm" icon={<Tags size={14} />} onClick={() => setCatOpen(true)}>Categories</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={print} disabled={loading}>Print</Button>
            <DownloadMenu items={[{ label: 'These expenses (CSV)', onClick: downloadRows }]} />
            {canFinance && <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>Record expense</Button>}
          </div>
        }
      />

      <PeriodBar from={from} to={to} onChange={({ from: a, to: b }) => setRange([a, b])}>
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="form-group biz-inline-search">
          <input type="search" data-page-search="" aria-label="Search expenses" placeholder="Search expenses" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </PeriodBar>

      {error && <div className="biz-error" role="alert">{error}<Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button></div>}

      <StatGroup loading={loading} label="Expenses summary" items={[
        { label: 'Spent', value: money(spent), hint: `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}` },
        { label: 'Paid in cash', value: money(cash), hint: 'Comes out of the cash drawer' },
        { label: 'Biggest category', value: biggest ? biggest.name : 'None', hint: biggest ? money(biggest.amount) : 'No expenses yet' },
      ]} />

      {byCat.length > 0 && (
        <section className="biz-section" aria-label="By category">
          <div className="biz-section-head"><h2>By category</h2></div>
          <div className="biz-cats">
            {byCat.map((c) => (
              <button key={c.name} type="button" className="biz-cat" onClick={() => setCategory(category === c.name ? '' : c.name)} aria-pressed={category === c.name} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', borderColor: category === c.name ? '#18181b' : undefined }}>
                <div className="biz-cat-head"><span>{c.name}</span><span>{money(c.amount)}</span></div>
                <div className="biz-cat-bar"><span style={{ width: `${spent ? Math.max(3, (c.amount / spent) * 100) : 0}%` }} /></div>
                <div className="biz-cat-share">{spent ? Math.round((c.amount / spent) * 100) : 0}% of spending</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="biz-section">
        <div className="biz-section-head"><h2>All expenses</h2>{category && <p>Showing {category} only. <button type="button" className="bill-inline-add" onClick={() => setCategory('')}>Show all</button></p>}</div>
        <ReportTable loading={loading} rows={rows}
          empty={search || category ? 'No expenses match these filters.' : 'No expenses were recorded in this period.'}
          columns={[
            { key: 'date', label: 'Date', render: (e) => <span className="muted">{dayLabel(e.date)}</span> },
            { key: 'category', label: 'Category', render: (e) => <span className="strong">{e.category}</span> },
            { key: 'details', label: 'Details', render: (e) => <><div>{e.name || e.description || <span className="muted">No details</span>}</div>{e.name && e.description && <div className="muted">{e.description}</div>}</> },
            { key: 'mode', label: 'Paid by', render: (e) => <span className={modeClass(e.paymentMethod)}>{e.paymentMethod}</span> },
            { key: 'amount', label: 'Amount', align: 'right', render: (e) => <span className="strong">{money(e.amount)}</span> },
            ...(canFinance ? [{ key: 'actions', label: '', align: 'right', render: (e) => (
              <RowMenu label={`Actions for ${e.category} ${money(e.amount)}`} items={[
                { label: 'Edit', onClick: () => openEdit(e) },
                { label: 'Delete', danger: true, onClick: () => setDeleteTarget(e) },
              ]} />
            ) }] : []),
          ]}
          totals={{ date: 'Total', category: `${rows.length} entries`, amount: money(spent) }} />
      </section>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} variant="drawer" title={editing ? 'Edit expense' : 'Record expense'}
        footer={<>
          <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>{editing ? 'Save changes' : 'Record expense'}</Button>
        </>}>
        <form className="biz-form" onSubmit={save}>
          {formErrors.api && <div className="biz-form-error" role="alert">{formErrors.api}</div>}
          <Select label="Category" value={form.category || ''} onChange={set('category')} options={catOptions.map((c) => ({ value: c, label: c }))} error={formErrors.category} required />
          <div className="biz-form-row">
            <Input label="Amount (₹)" type="number" inputMode="decimal" value={form.amount || ''} onChange={set('amount')} error={formErrors.amount} required autoFocus />
            <Input label="Date" type="date" value={form.date || ''} max={today()} onChange={set('date')} error={formErrors.date} required />
          </div>
          <Select label="Paid by" value={form.paymentMethod || 'Cash'} onChange={set('paymentMethod')} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} required />
          <Input label="Spent on" value={form.name || ''} onChange={set('name')} placeholder="e.g. Rent for March" />
          <Input label="Details" value={form.description || ''} onChange={set('description')} placeholder="e.g. 2 boxes of EDTA tubes" />
          <Input label="Notes" value={form.notes || ''} onChange={set('notes')} placeholder="Optional" />
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <Modal isOpen={catOpen} onClose={() => setCatOpen(false)} variant="drawer" title="Expense categories"
        footer={<Button variant="secondary" onClick={() => setCatOpen(false)}>Done</Button>}>
        <div className="biz-form">
          <p className="biz-note">These are the choices when you record an expense. Removing one does not change past expenses.</p>
          <div className="biz-cat-list">
            {allCats.map((c) => (
              <div key={c}><span>{c}</span><button type="button" onClick={() => saveCats(allCats.filter((x) => x !== c))} aria-label={`Remove category ${c}`}>Remove</button></div>
            ))}
          </div>
          <form className="biz-cat-add" onSubmit={(e) => { e.preventDefault(); const name = newCat.trim(); if (name && !allCats.includes(name)) { saveCats([...allCats, name]); } setNewCat(''); }}>
            <Input label="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Reagents" />
            <Button type="submit" variant="primary" disabled={!newCat.trim()}>Add</Button>
          </form>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this expense?"
        message={deleteTarget ? `${deleteTarget.category} - ${money(deleteTarget.amount)} on ${dayLabel(deleteTarget.date)}. This cannot be undone.` : ''}
        confirmText="Delete"
      />
    </div>
  );
}
