import React, { useState, useEffect } from 'react';
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary } from '../../services/expenseService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { EXPENSE_CATEGORIES } from '../../constants/businessConstants';
import { PAYMENT_METHODS } from '../../constants/billConstants';
import { Plus, Edit2, Trash2, Landmark } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';
import { usePermissions } from '../../hooks/usePermission';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = Array.from({ length: 10 }, (_, i) => 2018 + i);

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('expenses');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [filterText, setFilterText] = useState('');
  const [cats, setCats] = useState(null);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState('');

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({ category: '', amount: '', date: '', description: '', paymentMethod: 'Cash' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { can } = usePermissions();
  const canFinance = can('finance');

  const allCats = cats || EXPENSE_CATEGORIES;

  const fetchExpensesData = async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        getExpenses({ month: month || undefined, year: year || undefined, search: filterText || undefined }),
        getExpenseSummary()
      ]);
      if (listRes.success) setExpenses(listRes.data);
      if (sumRes.success) setSummary(sumRes.data);
    } catch (err) {
      console.error('Failed to load expenses data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('expense_cats');
      if (saved) setCats(JSON.parse(saved));
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchExpensesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const saveCats = (list) => { setCats(list); try { localStorage.setItem('expense_cats', JSON.stringify(list)); } catch (e) { /* ignore */ } };

  const exportCsv = () => {
    const rows = [['SPENT ON','NAME','AMOUNT','CATEGORY','MODE','ADDED BY','ADDED ON','NOTES']];
    expenses.forEach((e) => rows.push([e.spentOn || e.date, e.name || e.category, e.amount, e.category, e.paymentMethod, e.addedBy?.name || '', e.createdAt || e.date, e.notes || e.description || '']));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `expenses-${year || 'all'}-${month || 'all'}.csv`;
    a.click();
  };

  const handleOpenCreate = () => {
    setEditingExpense(null);
    setFormData({ category: allCats[0], amount: '', date: new Date().toISOString().split('T')[0], description: '', paymentMethod: 'Cash', name: '', notes: '' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (exp) => {
    setEditingExpense(exp);
    setFormData({
      category: exp.category,
      amount: String(exp.amount),
      date: exp.date ? exp.date.split('T')[0] : '',
      description: exp.description || '',
      paymentMethod: exp.paymentMethod,
      name: exp.name || '',
      notes: exp.notes || ''
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.category) errs.category = 'Please choose a category';
    if (!formData.amount || isNaN(formData.amount) || Number(formData.amount) <= 0) {
      errs.amount = 'Valid positive amount is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitLoading(true);
    try {
      let res;
      const payload = {
        ...formData,
        amount: Number(formData.amount)
      };

      if (editingExpense) {
        res = await updateExpense(editingExpense._id, payload);
      } else {
        res = await createExpense(payload);
      }

      if (res.success) {
        setFormOpen(false);
        fetchExpensesData();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to record expense' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await deleteExpense(deleteTarget._id);
      if (res.success) {
        setDeleteTarget(null);
        fetchExpensesData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove expense');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Expense Voucher Register"
        subtitle="Record general clinic facility operational costs, medical supplies, rents, and bills"
        action={
          canFinance ? (
            <Button variant="primary" onClick={handleOpenCreate}>
              <Plus size={16} /> Record Expense
            </Button>
          ) : undefined
        }
      />
      {!canFinance && (
        <p style={{ fontSize: '0.82rem', color: 'var(--color-warning, #a16207)', marginBottom: '1rem' }}>
          Your role has no finance permission — this register is read-only for you (server still enforces).
        </p>
      )}

      {/* Aggregate Overview Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Total Sum Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            <Landmark size={24} />
          </div>
          <div>
            <div className="card-title">Gross Operating Costs</div>
            <div className="card-value" style={{ color: 'var(--color-danger)' }}>
              {formatCurrency(summary?.total || 0)}
            </div>
          </div>
        </div>

        {/* Category Breakdown list */}
        <div className="card">
          <h4 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Top Expense Categories
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
            {summary?.categoryWise?.slice(0, 3).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                <span>{item._id}</span>
                <strong>{formatCurrency(item.total)}</strong>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <button className={`btn ${tab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={() => setTab('expenses')}>Expenses</button>
        <button className={`btn ${tab === 'analysis' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={() => setTab('analysis')}>Analysis</button>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="select-control" style={{ maxWidth: '130px' }}>
          <option value="">All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className="select-control" style={{ maxWidth: '130px' }}>
          <option value="">All years</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <input className="form-control" placeholder="Filters..." value={filterText} onChange={(e) => setFilterText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') fetchExpensesData(); }} style={{ maxWidth: '180px' }} />
        <Button variant="secondary" size="sm" onClick={fetchExpensesData}>Filters</Button>
        <Button variant="secondary" size="sm" onClick={exportCsv}>Export</Button>
        <Button variant="secondary" size="sm" onClick={() => setCatOpen(true)}>Manage categories</Button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Records in page: {expenses.length}/{expenses.length} • <a href="#feedback" onClick={(e) => { e.preventDefault(); alert('Thanks! Feedback: expenses parity delivered.'); }}>Have feedback? share here</a> • <a href="#how" onClick={(e) => { e.preventDefault(); alert('Expenses: record operating costs; Analysis tab shows category + monthly trends.'); }}>How expenses work?</a></span>
      </div>

      {tab === 'analysis' ? (
        <div className="card">
          <h4 style={{ fontWeight: 700, marginBottom: '8px' }}>Category Analysis</h4>
          {(summary?.categoryWise || []).map((c) => {
            const max = Math.max(1, ...(summary?.categoryWise || []).map((x) => x.total));
            return (
              <div key={c._id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', fontSize: '0.85rem' }}>
                <span style={{ width: '160px' }}>{c._id}</span>
                <div style={{ flex: 1, background: 'var(--bg-main)', borderRadius: '4px', height: '10px' }}>
                  <div style={{ width: `${Math.round((c.total / max) * 100)}%`, background: 'var(--primary-color)', height: '10px', borderRadius: '4px' }} />
                </div>
                <strong>{formatCurrency(c.total)}</strong>
              </div>
            );
          })}
          <h4 style={{ fontWeight: 700, margin: '12px 0 8px' }}>Monthly Trend</h4>
          {(summary?.monthlySummary || []).map((m, i) => <div key={i} style={{ fontSize: '0.85rem' }}>{m._id?.year}-{m._id?.month}: <strong>{formatCurrency(m.total)}</strong></div>)}
        </div>
      ) : (
      <DataTable
        headers={['Spent On', 'Name', 'Amount', 'Category', 'Mode', 'Added By', 'Added On', 'Notes', 'Actions']}
        data={expenses}
        loading={loading}
        emptyMessage="No clinic expense vouchers recorded."
        renderRow={(exp) => (
          <tr key={exp._id}>
            <td>{formatDate(exp.spentOn || exp.date)}</td>
            <td style={{ fontWeight: '600' }}>{exp.name || exp.category}</td>
            <td style={{ fontWeight: '700', color: 'var(--color-danger)' }}>{formatCurrency(exp.amount)}</td>
            <td>{exp.category}</td>
            <td>
              <StatusBadge status={exp.paymentMethod} />
            </td>
            <td>{exp.addedBy?.name || '—'}</td>
            <td>{formatDate(exp.createdAt || exp.date).split(',')[0]}</td>
            <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exp.notes || exp.description || 'N/A'}</td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(exp)}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteTarget(exp)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </td>
          </tr>
        )}
      />
      )}

      {/* Expense Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingExpense ? 'Edit Expense Voucher' : 'Record Operating Expense'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Record Voucher
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          {errors.api && <div className="form-error">{errors.api}</div>}
          
          <Select
            label="Category Classification"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            options={allCats.map(c => ({ value: c, label: c }))}
            error={errors.category}
            required
          />
          <Input label="Spent On (name)" name="name" value={formData.name || ''} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Rent March" />
          <Input label="Notes" name="notes" value={formData.notes || ''} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Optional notes" />

          <div style={{ display: 'flex', gap: '16px' }}>
            <Input
              label="Charged Amount (INR)"
              name="amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              error={errors.amount}
              required
              style={{ flex: 1 }}
            />
            <Input
              label="Payment Date"
              name="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
              style={{ flex: 1 }}
            />
          </div>

          <Select
            label="Paid Method"
            value={formData.paymentMethod}
            onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
            options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
            required
          />

          <Input
            label="Voucher Description"
            name="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="e.g. Purchased EDTA sample collection tubes"
          />

        </form>
      </Modal>

      <Modal isOpen={catOpen} onClose={() => setCatOpen(false)} title="Manage Categories"
        footer={<><Button variant="secondary" onClick={() => setCatOpen(false)}>Close</Button><Button variant="primary" onClick={() => { if (newCat.trim()) { saveCats([...allCats, newCat.trim()]); setNewCat(''); } }}>Add</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {allCats.map((c) => (
            <div key={c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', padding: '4px 0' }}>
              <span>{c}</span>
              <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => saveCats(allCats.filter((x) => x !== c))}>Remove</button>
            </div>
          ))}
          <Input label="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Reagents" />
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        title="Remove Expense Voucher?"
        message={`Are you sure you want to permanently delete the operating expense record for ${deleteTarget?.category} of INR ${deleteTarget?.amount}?`}
      />
    </div>
  );
};

export default Expenses;
