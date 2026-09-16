import React, { useState, useEffect } from 'react';
import { getDailyBusiness } from '../../services/dashboardService';
import { getExpenses } from '../../services/expenseService';
import { sendMessage } from '../../services/notifyService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { Printer, Mail } from 'lucide-react';
import { PageHeader, DataTable, DatePicker, StatusBadge, Select } from '../../components/common';

const DailyBusiness = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [data, setData] = useState(null);
  const [expensesList, setExpensesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'bills' | 'expenses'
  const [searchQuery, setSearchQuery] = useState('');
  const [cashierFilter, setCashierFilter] = useState('All');
  const [emailLoading, setEmailLoading] = useState(false);

  const fetchBusinessLedger = async () => {
    setLoading(true);
    try {
      const [bizRes, expRes] = await Promise.all([
        getDailyBusiness(startDate, endDate),
        getExpenses({ startDate, endDate })
      ]);
      if (bizRes.success) setData(bizRes.data);
      if (expRes.success) setExpensesList(expRes.data);
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
  const totalRefunds = data?.totalRefunds || 0;
  const collectionCharge = 0;
  const totalExpenses = data?.totalExpenses || 0;
  const netIncome = data?.netIncome ?? totalIncome + collectionCharge - totalExpenses;

  const cashierNames = [...new Set((data?.cashierWise || []).map((c) => c.name))].filter(Boolean);
  const cashierOptions = [{ value: 'All', label: 'All cashiers' }, ...cashierNames.map((n) => ({ value: n, label: n }))];

  const matchSearch = (tx) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return tx.patient?.name?.toLowerCase().includes(q) || tx.bill?.billNumber?.toLowerCase().includes(q);
  };
  const matchCashier = (tx) => cashierFilter === 'All' || (tx.receivedBy?.name || 'Unknown') === cashierFilter;

  const getFilteredTransactions = () => (data?.transactions || []).filter((tx) => matchSearch(tx) && matchCashier(tx));

  const getFilteredBills = () => {
    const list = data?.transactions?.map(tx => tx.bill).filter(Boolean) || [];
    const uniqueBills = Array.from(new Map(list.map(b => [b._id, b])).values());
    if (!searchQuery.trim()) return uniqueBills;
    const q = searchQuery.toLowerCase();
    return uniqueBills.filter(b =>
      b.billNumber?.toLowerCase().includes(q) || b.patient?.name?.toLowerCase().includes(q));
  };

  const getFilteredExpenses = () => {
    if (!searchQuery.trim()) return expensesList;
    const q = searchQuery.toLowerCase();
    return expensesList.filter(e =>
      e.category?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q));
  };

  const handleEmailSummary = async () => {
    const to = prompt('Recipient email for daily business summary:');
    if (!to || !to.trim()) return;
    setEmailLoading(true);
    try {
      const fallbackText = `Daily summary ${startDate} to ${endDate}: Net ${formatCurrency(netIncome)}, Income ${formatCurrency(totalIncome)}, Refunds ${formatCurrency(totalRefunds)}, Expenses ${formatCurrency(totalExpenses)}.`;
      await sendMessage({ channel: 'email', templateKey: 'daily-summary', to: to.trim(), vars: { fallbackText, subject: 'Daily business summary' } });
      alert('Summary emailed.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to email summary');
    } finally {
      setEmailLoading(false);
    }
  };

  const overview = data?.monthlyOverview || [];
  const ovMax = Math.max(1, ...overview.map((d) => d.income || 0));
  const ovW = Math.max(200, overview.length * 46);

  return (
    <div>
      <PageHeader
        title="Daily Business Ledger"
        subtitle="Operational ledger tracing invoice sales, expenses logs, and payments"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => window.print()} style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}>
              <Printer size={16} /> Print
            </button>
            <button className="btn btn-primary" onClick={handleEmailSummary} disabled={emailLoading} style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}>
              <Mail size={16} /> {emailLoading ? 'Sending...' : 'Email Summary'}
            </button>
          </div>
        }
      />

      {/* Date Selectors & Quick Status */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DatePicker label="" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ marginBottom: 0, width: '150px' }} />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>to</span>
          <DatePicker label="" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ marginBottom: 0, width: '150px' }} />
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
          <div className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--primary-light)', border: '1px solid var(--primary-color)', borderRadius: 'var(--border-radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '1rem', fontWeight: '600', color: 'var(--primary-color)' }}>
            <span>Total Income {formatCurrency(totalIncome)}</span>
            <span>+</span>
            <span>Collection Charge {formatCurrency(collectionCharge)}</span>
            <span>-</span>
            <span>Expenses {formatCurrency(totalExpenses)}</span>
            <span>=</span>
            <span style={{ color: 'var(--color-success)', fontWeight: '700' }}>Net Income {formatCurrency(netIncome)}</span>
          </div>

          {/* Payment Method Split Bar */}
          <div className="card" style={{ padding: '1rem', borderRadius: 'var(--border-radius-sm)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-main)', border: '1px dashed var(--border-color)' }}>
            {['Cash', 'Card', 'UPI', 'Insurance'].map((m) => (
              <div key={m}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{m}: </span>
                <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(data?.incomeSplit?.[m] || 0)}</strong>
              </div>
            ))}
          </div>

          {/* Monthly Overview Strip: income vs net per day */}
          {overview.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
              <h4 style={{ fontWeight: '700', fontSize: '0.875rem', marginBottom: '8px' }}>Daily Overview — Income vs Net</h4>
              <svg viewBox={`0 0 ${ovW} 150`} width={ovW} height="150" role="img">
                {overview.map((d, i) => {
                  const ih = Math.max(2, ((d.income || 0) / ovMax) * 110);
                  const nh = Math.max(2, (Math.max(0, d.net || 0) / ovMax) * 110);
                  const x = 10 + i * 46;
                  return (
                    <g key={d.date}>
                      <title>{`${d.date}: income ${d.income}, net ${d.net}`}</title>
                      <rect x={x} y={120 - ih} width="18" height={ih} rx="2" fill="var(--primary-color)" opacity="0.85" />
                      <rect x={x + 20} y={120 - nh} width="18" height={nh} rx="2" fill="var(--color-success)" opacity="0.85" />
                      <text x={x + 19} y="134" fontSize="8" fill="var(--text-muted)" textAnchor="middle">{d.date.slice(5)}</text>
                    </g>
                  );
                })}
              </svg>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--primary-color)', borderRadius: 2 }} /> Income</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--color-success)', borderRadius: 2 }} /> Net</span>
              </div>
            </div>
          )}

          {/* Case-type Split Table */}
          {(data?.caseSplit?.length > 0) && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontWeight: '700', fontSize: '0.875rem', marginBottom: '8px' }}>Case-Type Split</h4>
              <DataTable
                headers={['Department', 'Cases', 'Billed', 'Collected', 'Due']}
                data={data.caseSplit}
                emptyMessage="No department split for this window."
                renderRow={(c) => (
                  <tr key={c.department}>
                    <td style={{ fontWeight: '600' }}>{c.department}</td>
                    <td>{c.count}</td>
                    <td>{formatCurrency(c.billed)}</td>
                    <td style={{ color: 'var(--color-success)', fontWeight: '600' }}>{formatCurrency(c.collected)}</td>
                    <td style={{ color: c.due > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: '600' }}>{formatCurrency(c.due)}</td>
                  </tr>
                )}
              />
            </div>
          )}

          {/* Filter Tabs & Search + Cashier filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['transactions', 'bills', 'expenses'].map((t) => (
                <button key={t} className={`btn ${activeTab === t ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setActiveTab(t); setSearchQuery(''); }} style={{ padding: '0.5rem 1rem', fontSize: '0.825rem', textTransform: 'capitalize' }}>
                  {t} ({t === 'transactions' ? getFilteredTransactions().length : t === 'bills' ? getFilteredBills().length : getFilteredExpenses().length})
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Select name="cashier" value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)}
                options={cashierOptions} placeholder="All cashiers" style={{ marginBottom: 0, minWidth: '160px' }} />
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '4px 12px', backgroundColor: 'var(--bg-card)' }}>
                <input type="text" placeholder="Search in page..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '0.825rem', width: '200px', background: 'transparent' }} />
              </div>
            </div>
          </div>

          {/* Cashier-wise summary */}
          {(data?.cashierWise?.length > 0) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {data.cashierWise.map((c) => (
                <span key={c.userId} className="card" style={{ padding: '4px 12px' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{c.name}</strong>: {formatCurrency(c.income)} ({c.count})
                </span>
              ))}
            </div>
          )}

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
                  <td><StatusBadge status={tx.paymentMethod} /></td>
                  <td>{tx.receivedBy?.name || 'Unknown'}</td>
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
                  <td style={{ color: bill.dueAmount > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: '600' }}>{formatCurrency(bill.dueAmount)}</td>
                  <td><StatusBadge status={bill.paymentStatus} /></td>
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
                  <td><StatusBadge status={exp.paymentMethod} /></td>
                  <td style={{ fontWeight: '700', color: 'var(--color-danger)' }}>{formatCurrency(exp.amount)}</td>
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
