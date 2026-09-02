import React, { useState, useEffect } from 'react';
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary } from '../../services/expenseService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { EXPENSE_CATEGORIES } from '../../constants/businessConstants';
import { PAYMENT_METHODS } from '../../constants/billConstants';
import { Plus, Edit2, Trash2, Landmark } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Input, Select, ConfirmDialog, StatusBadge } from '../../components/common';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({ category: '', amount: '', date: '', description: '', paymentMethod: 'Cash' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchExpensesData = async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        getExpenses(),
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
    fetchExpensesData();
  }, []);

  const handleOpenCreate = () => {
    setEditingExpense(null);
    setFormData({ category: EXPENSE_CATEGORIES[0], amount: '', date: new Date().toISOString().split('T')[0], description: '', paymentMethod: 'Cash' });
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
      paymentMethod: exp.paymentMethod
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
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Record Expense
          </Button>
        }
      />

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

      <DataTable
        headers={['Voucher Date', 'Category Classification', 'Description', 'Paid via', 'Amount Charged', 'Actions']}
        data={expenses}
        loading={loading}
        emptyMessage="No clinic expense vouchers recorded."
        renderRow={(exp) => (
          <tr key={exp._id}>
            <td>{formatDate(exp.date)}</td>
            <td style={{ fontWeight: '600' }}>{exp.category}</td>
            <td>{exp.description || 'N/A'}</td>
            <td>
              <StatusBadge status={exp.paymentMethod} />
            </td>
            <td style={{ fontWeight: '700', color: 'var(--color-danger)' }}>
              {formatCurrency(exp.amount)}
            </td>
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
            options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
            error={errors.category}
            required
          />

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
