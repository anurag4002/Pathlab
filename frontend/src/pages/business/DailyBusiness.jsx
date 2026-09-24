import React, { useEffect, useRef, useState } from 'react';
import { getDailyBusiness } from '../../services/dashboardService';
import { getExpenses } from '../../services/expenseService';
import { downloadServerCsv } from '../../services/exportService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { PageHeader, DataTable, DatePicker, StatusBadge, Select, Button } from '../../components/common';

/* Local API error mapper (same mapping as the other lab screens): surfaces
   only the backend's user-facing `message` field, never stack traces. */
const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    const status = err.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to view business information.';
    if (status === 404) return 'The requested record was not found.';
    if (status === 409) return 'The record was changed elsewhere. Please refresh and try again.';
    if (status === 422) return 'The submitted data is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request) return 'Network error. Please check your connection and try again.';
  return err?.message || fallback;
};

/* Load-failure banner with a right-aligned retry — matches the danger-bg
   error blocks used elsewhere in the app. */
const ErrorBanner = ({ message, onRetry }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      backgroundColor: 'var(--color-danger-bg)',
      color: 'var(--color-danger)',
      borderRadius: 'var(--radius-sm)',
      marginBottom: 'var(--space-4)'
    }}
  >
    <span>{message}</span>
    <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={onRetry} style={{ marginLeft: 'auto' }}>
      Retry
    </Button>
  </div>
);

/* One summary metric cell — values are always passed straight from the API
   response; this component performs no formatting beyond what it is given. */
const Metric = ({ label, value, color }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
    <span
      style={{
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      }}
    >
      {label}
    </span>
    <strong style={{ fontSize: 'var(--font-size-lg)', color: color || 'var(--color-text)' }}>{value}</strong>
  </div>
);

const DailyBusiness = () => {
  // Default window: today, following the app-wide ISO-date convention.
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [data, setData] = useState(null);
  const [expensesList, setExpensesList] = useState([]);
  const [loading, setLoading] = useState(false);
  // Separate error per fetch group so one group's failure never clears the
  // other's data, and a failed load never renders as "all zeros".
  const [error, setError] = useState(null);
  const [expensesError, setExpensesError] = useState(null);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'bills' | 'expenses'
  const [searchQuery, setSearchQuery] = useState('');
  const [cashierFilter, setCashierFilter] = useState('All');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportNotice, setExportNotice] = useState('');
  const exportInFlightRef = useRef(false);

  const invalidRange = !!(startDate && endDate && endDate < startDate);

  const fetchBusinessLedger = async () => {
    setLoading(true);
    setError(null);
    setExpensesError(null);
    // The dashboard endpoint parses endDate with new Date(); a date-only value
    // would collapse a single-day window to one instant, so pass end-of-day —
    // the same instant the expenses endpoint computes via setHours(23,59,59,999).
    const endParam = endDate ? `${endDate}T23:59:59.999` : endDate;
    const [bizRes, expRes] = await Promise.allSettled([
      getDailyBusiness(startDate, endParam),
      getExpenses({ startDate, endDate: endParam })
    ]);
    if (bizRes.status === 'fulfilled' && bizRes.value?.success) {
      setData(bizRes.value.data);
    } else {
      setData(null);
      setError(
        getApiErrorMessage(
          bizRes.status === 'rejected' ? bizRes.reason : null,
          'Failed to load the daily business report.'
        )
      );
    }
    if (expRes.status === 'fulfilled' && expRes.value?.success) {
      setExpensesList(expRes.value.data);
    } else {
      setExpensesList([]);
      setExpensesError(
        getApiErrorMessage(
          expRes.status === 'rejected' ? expRes.reason : null,
          'Failed to load expenses for this period.'
        )
      );
    }
    setLoading(false);
  };

  const handleStartDateChange = (event) => {
    setStartDate(event.target.value);
    setExportError(null);
    setExportNotice('');
  };

  const handleEndDateChange = (event) => {
    setEndDate(event.target.value);
    setExportError(null);
    setExportNotice('');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setExportError(null);
    setExportNotice('');
  };

  const handleExport = async () => {
    if (invalidRange || exportInFlightRef.current) return;

    exportInFlightRef.current = true;
    setExporting(true);
    setExportError(null);
    setExportNotice('');
    try {
      const result = await downloadServerCsv(activeTab, { startDate, endDate });
      setExportNotice(`CSV download started: ${result.filename}`);
    } catch (error) {
      setExportError(error?.message || getApiErrorMessage(error, `Failed to export ${activeTab} for this date range.`));
    } finally {
      exportInFlightRef.current = false;
      setExporting(false);
    }
  };

  useEffect(() => {
    if (invalidRange) return;
    fetchBusinessLedger();
  }, [startDate, endDate, invalidRange]);

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

  const cashierNames = [...new Set((data?.cashierWise || []).map((c) => c.name))].filter(Boolean);
  const cashierOptions = [{ value: 'All', label: 'All cashiers' }, ...cashierNames.map((n) => ({ value: n, label: n }))];

  const overview = data?.monthlyOverview || [];
  const ovMax = Math.max(1, ...overview.map((d) => d.income || 0));
  const ovW = Math.max(200, overview.length * 46);

  return (
    <div>
      <PageHeader
        title="Daily Business Ledger"
        subtitle="Operational ledger tracing invoice sales, expenses logs, and payments"
        action={
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>
              Print
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              loading={exporting}
              disabled={invalidRange || loading}
              onClick={handleExport}
            >
              Export {activeTab} for date range (CSV)
            </Button>
          </div>
        }
      />

      {/* Date Selectors & Quick Status */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DatePicker label="" value={startDate} onChange={handleStartDateChange} style={{ marginBottom: 0, width: '150px' }} />
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>to</span>
          <DatePicker label="" value={endDate} onChange={handleEndDateChange} style={{ marginBottom: 0, width: '150px' }} />
        </div>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>
          Today: {formatDate(new Date()).split(',')[0]}
        </div>
      </div>

      {invalidRange && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-4)',
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-danger)',
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.5rem'
          }}
        >
          End date must be on or after start date.
        </div>
      )}

      {exportError && <ErrorBanner message={exportError} onRetry={handleExport} />}
      {exportNotice && (
        <div role="status" style={{ marginBottom: 'var(--space-4)', color: 'var(--color-success)', fontSize: 'var(--font-size-sm)' }}>
          {exportNotice}
        </div>
      )}
      {!invalidRange && (
        <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          CSV export uses the selected date range and all matching server records for the active tab, up to the backend's 5,000-row cap. In-page search and cashier filters are not sent to the export endpoint.
        </p>
      )}

      {!invalidRange && error && <ErrorBanner message={error} onRetry={fetchBusinessLedger} />}

      {!invalidRange && (loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
        </div>
      ) : data && (
        <>
          {/* Summary metrics — every value straight from GET /dashboard/business */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-4)' }}>
              <Metric
                label="Net"
                value={formatCurrency(data.netIncome)}
                color={
                  data.netIncome > 0
                    ? 'var(--color-success)'
                    : data.netIncome < 0
                      ? 'var(--color-danger)'
                      : 'var(--color-text)'
                }
              />
              <Metric label="Income" value={formatCurrency(data.totalIncome)} />
              <Metric
                label="Refunds"
                value={formatCurrency(data.totalRefunds)}
                color={data.totalRefunds > 0 ? 'var(--color-danger)' : 'var(--color-text)'}
              />
              <Metric label="Expenses" value={formatCurrency(data.totalExpenses)} />
              <Metric label="Transactions" value={data.transactions?.length ?? 0} />
              <Metric label="Expense entries" value={expensesError ? '—' : (expensesList?.length ?? 0)} />
            </div>
          </div>

          {/* Collections by payment mode — keys come from the API's incomeSplit */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontWeight: '700', fontSize: '0.875rem', marginBottom: '8px' }}>Collections by payment mode</h4>
            {(data.totalIncome || 0) > 0 ? (
              <div className="card" style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--color-background)', border: '1px dashed var(--color-border)' }}>
                {Object.entries(data.incomeSplit || {}).map(([mode, amount]) => (
                  <div key={mode}>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{mode}: </span>
                    <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(amount)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 0 }}>
                No collections recorded for this period.
              </div>
            )}
          </div>

          {/* Monthly Overview Strip: income vs net per day (server-provided series) */}
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
                      <rect x={x} y={120 - ih} width="18" height={ih} rx="2" fill="var(--color-primary)" opacity="0.85" />
                      <rect x={x + 20} y={120 - nh} width="18" height={nh} rx="2" fill="var(--color-success)" opacity="0.85" />
                      <text x={x + 19} y="134" fontSize="8" fill="var(--color-text-muted)" textAnchor="middle">{d.date.slice(5)}</text>
                    </g>
                  );
                })}
              </svg>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--color-primary)', borderRadius: 2 }} /> Income</span>
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
                  disabled={exporting}
                  onClick={() => handleTabChange(t)} style={{ padding: '0.5rem 1rem', fontSize: '0.825rem', textTransform: 'capitalize' }}>
                  {t} ({t === 'transactions' ? getFilteredTransactions().length : t === 'bills' ? getFilteredBills().length : getFilteredExpenses().length})
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Select name="cashier" value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)}
                options={cashierOptions} placeholder="All cashiers" style={{ marginBottom: 0, minWidth: '160px' }} />
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', backgroundColor: 'var(--color-surface)' }}>
                <input type="text" placeholder="Search in page..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '0.825rem', width: '200px', background: 'transparent' }} />
              </div>
            </div>
          </div>

          {/* Cashier-wise summary (server-grouped collections per user) */}
          {(data?.cashierWise?.length > 0) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {data.cashierWise.map((c) => (
                <span key={c.userId} className="card" style={{ padding: '4px 12px' }}>
                  <strong style={{ color: 'var(--color-text)' }}>{c.name}</strong>: {formatCurrency(c.income)} ({c.count})
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

          {activeTab === 'expenses' && (expensesError ? (
            <ErrorBanner message={expensesError} onRetry={fetchBusinessLedger} />
          ) : (
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
          ))}
        </>
      ))}
    </div>
  );
};

export default DailyBusiness;
