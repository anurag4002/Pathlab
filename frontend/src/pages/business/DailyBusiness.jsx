import React, { useState, useEffect } from 'react';
import { getDailyBusiness } from '../../services/dashboardService';
import { getExpenses } from '../../services/expenseService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { FileText, Receipt, Wallet, Plus } from 'lucide-react';
import { PageHeader, DataTable, DatePicker, StatusBadge } from '../../components/common';

const DailyBusiness = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [data, setData] = useState(null);
  const [expensesList, setExpensesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'bills' | 'expenses'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBusinessLedger = async () => {
    setLoading(true);
    try {
      const [bizRes, expRes] = await Promise.all([
        getDailyBusiness(startDate, endDate),
        getExpenses({ startDate, endDate })
      ]);
      if (bizRes.success) {
        setData(bizRes.data);
      }
      if (expRes.success) {
        setExpensesList(expRes.data);
      }
    } catch (err) {
      console.error('Failed to load daily business report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessLedger();
  }, [startDate, endDate]);

  const totalIncome = data?.totalIncome || 0;
  const collectionCharge = 0;
  const totalExpenses = data?.totalExpenses || 0;
  const netIncome = totalIncome + collectionCharge - totalExpenses;

  // Filter items in client based on search query
  const getFilteredTransactions = () => {
    const list = data?.transactions || [];
    if (!searchQuery.trim()) return list;
    return list.filter(tx =>
      tx.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.bill?.billNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getFilteredBills = () => {
    const list = data?.transactions?.map(tx => tx.bill).filter(Boolean) || [];
    // remove duplicates
    const uniqueBills = Array.from(new Map(list.map(b => [b._id, b])).values());
    if (!searchQuery.trim()) return uniqueBills;
    return uniqueBills.filter(b =>
      b.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getFilteredExpenses = () => {
    if (!searchQuery.trim()) return expensesList;
    return expensesList.filter(e =>
      e.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <div>
      <PageHeader
        title="Daily Business Ledger"
        subtitle="Operational ledger tracing invoice sales, expenses logs, and payments"
        action={
          <button className="btn btn-primary" onClick={() => alert('Add cashier configuration simulated.')}>
            <Plus size={16} /> Add Cashier
          </button>
        }
      />

      {/* Date Selectors & Quick Status */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DatePicker
            label=""
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ marginBottom: 0, width: '150px' }}
          />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>to</span>
          <DatePicker
            label=""
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ marginBottom: 0, width: '150px' }}
          />
        </div>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>
          Today: {formatDate(new Date()).split(',')[0]}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {/* Summary Formula Box */}
          <div
            className="card"
            style={{
              padding: '1.25rem',
              backgroundColor: 'var(--primary-light)',
              border: '1px solid var(--primary-color)',
              borderRadius: 'var(--border-radius-md)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              color: 'var(--primary-color)'
            }}
          >
            <span>Total Income {formatCurrency(totalIncome)}</span>
            <span>+</span>
            <span>Collection Charge {formatCurrency(collectionCharge)}</span>
            <span>-</span>
            <span>Expenses {formatCurrency(totalExpenses)}</span>
            <span>=</span>
            <span style={{ color: 'var(--color-success)', fontWeight: '700' }}>Net Income {formatCurrency(netIncome)}</span>
          </div>

          {/* Payment Method Split Bar */}
          <div
            className="card"
            style={{
              padding: '1rem',
              borderRadius: 'var(--border-radius-sm)',
              marginBottom: '2rem',
              display: 'flex',
              justifyContent: 'space-around',
              flexWrap: 'wrap',
              gap: '16px',
              backgroundColor: 'var(--bg-main)',
              border: '1px dashed var(--border-color)'
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Cash: </span>
              <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(data?.incomeSplit?.Cash || 0)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Card: </span>
              <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(data?.incomeSplit?.Card || 0)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>UPI: </span>
              <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(data?.incomeSplit?.UPI || 0)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Insurance: </span>
              <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(data?.incomeSplit?.Insurance || 0)}</strong>
            </div>
          </div>

          {/* Filter Tabs & Search in Page */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn ${activeTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setActiveTab('transactions'); setSearchQuery(''); }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}
              >
                Transactions ({getFilteredTransactions().length})
              </button>
              <button
                className={`btn ${activeTab === 'bills' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setActiveTab('bills'); setSearchQuery(''); }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}
              >
                Bills ({getFilteredBills().length})
              </button>
              <button
                className={`btn ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setActiveTab('expenses'); setSearchQuery(''); }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}
              >
                Expenses ({getFilteredExpenses().length})
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '4px 12px', backgroundColor: 'var(--bg-card)' }}>
              <input
                type="text"
                placeholder="Search in page..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '0.825rem', width: '200px', background: 'transparent' }}
              />
            </div>
          </div>

          {/* Render Active Tab Table */}
          {activeTab === 'transactions' && (
            <DataTable
              headers={['ID Ref', 'Patient Name', 'Date & Time', 'Method', 'Received By', 'Amount']}
              data={getFilteredTransactions()}
              emptyMessage="No transactions matched filters."
              renderRow={(tx) => (
                <tr key={tx._id}>
                  <td style={{ fontSize: '0.75rem', fontFamily: 'Courier' }}>{tx._id.slice(-8).toUpperCase()}</td>
                  <td style={{ fontWeight: '600' }}>{tx.patient?.name || 'Walk-in Patient'}</td>
                  <td>{formatDate(tx.date)}</td>
                  <td>
                    <StatusBadge status={tx.paymentMethod} />
                  </td>
                  <td>{tx.receivedBy?.name || 'Clerk'}</td>
                  <td style={{ fontWeight: '700', color: tx.type === 'Refund' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {tx.type === 'Refund' ? '-' : ''}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              )}
            />
          )}

          {activeTab === 'bills' && (
            <DataTable
              headers={['Bill Number', 'Patient Name', 'Date', 'Gross Total', 'Paid Amount', 'Due Balance', 'Status']}
              data={getFilteredBills()}
              emptyMessage="No bills matched filters."
              renderRow={(bill) => (
                <tr key={bill._id}>
                  <td style={{ fontWeight: '600' }}>{bill.billNumber}</td>
                  <td>{bill.patient?.name || 'Walk-in Patient'}</td>
                  <td>{formatDate(bill.date).split(',')[0]}</td>
                  <td>{formatCurrency(bill.totalAmount)}</td>
                  <td style={{ color: 'var(--color-success)', fontWeight: '600' }}>{formatCurrency(bill.paidAmount)}</td>
                  <td style={{ color: bill.dueAmount > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: '600' }}>
                    {formatCurrency(bill.dueAmount)}
                  </td>
                  <td>
                    <StatusBadge status={bill.paymentStatus} />
                  </td>
                </tr>
              )}
            />
          )}

          {activeTab === 'expenses' && (
            <DataTable
              headers={['Date', 'Category Classification', 'Description', 'Method', 'Amount Charged']}
              data={getFilteredExpenses()}
              emptyMessage="No expenses logs matched filters."
              renderRow={(exp) => (
                <tr key={exp._id}>
                  <td>{formatDate(exp.date).split(',')[0]}</td>
                  <td style={{ fontWeight: '600' }}>{exp.category}</td>
                  <td>{exp.description || 'N/A'}</td>
                  <td>
                    <StatusBadge status={exp.paymentMethod} />
                  </td>
                  <td style={{ fontWeight: '700', color: 'var(--color-danger)' }}>
                    {formatCurrency(exp.amount)}
                  </td>
                </tr>
              )}
            />
          )}
        </>
      )}
    </div>
  );
};

export default DailyBusiness;
