import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { getDailyBusiness } from '../../services/dashboardService';
import { getExpenses } from '../../services/expenseService';
import { getTransactions } from '../../services/transactionService';
import { downloadServerCsv } from '../../services/exportService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';
import { SvgBars, SvgLine } from '../../components/charts/SvgCharts';
import {
  Button,
  DataTable,
  EmptyState,
  Input,
  LoadingSpinner,
  PageHeader,
  Select,
  StatCard,
  StatusBadge
} from '../../components/common';

const MONTH_VALUE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const TRANSACTION_TYPE_FILTERS = ['Income', 'Refund', 'Expense'];

const getLocalMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthRange = (monthValue) => {
  if (typeof monthValue !== 'string' || !MONTH_VALUE_PATTERN.test(monthValue)) return null;

  const [yearText, monthText] = monthValue.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const lastDate = new Date(year, monthIndex + 1, 0);
  const endDate = `${monthValue}-${String(lastDate.getDate()).padStart(2, '0')}`;

  return {
    startDate: `${monthValue}-01`,
    endDate,
    // The dashboard endpoint parses endDate with new Date(). Sending the
    // end-of-day instant follows the existing Daily Business convention.
    endOfDay: `${endDate}T23:59:59.999`,
    label: new Intl.DateTimeFormat('en-IN', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(year, monthIndex, 1, 12))
  };
};

const hasValue = (value) =>
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));

const formatApiCurrency = (value) => (hasValue(value) ? formatCurrency(value) : '—');
const formatApiCount = (value) => (hasValue(value) ? String(value) : '—');

const getApiErrorMessage = (error, fallback) => {
  if (error?.response) {
    const message = error.response.data?.message;
    if (typeof message === 'string' && message.trim()) return message;

    const status = error.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to view business information.';
    if (status === 404) return 'The requested business record was not found.';
    if (status === 409) return 'The business data changed elsewhere. Please refresh and try again.';
    if (status === 422) return 'The selected business filter is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }

  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.request) return 'Network error. Please check your connection and try again.';
  return error?.message || fallback;
};

const ErrorBanner = ({ message, onRetry }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      marginBottom: 'var(--space-4)',
      color: 'var(--color-danger)',
      backgroundColor: 'var(--color-danger-bg)',
      border: '1px solid var(--color-danger-border)',
      borderRadius: 'var(--radius-sm)'
    }}
  >
    <span>{message}</span>
    {onRetry && (
      <Button
        variant="secondary"
        size="sm"
        icon={<RefreshCw size={14} />}
        onClick={onRetry}
        style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
      >
        Retry
      </Button>
    )}
  </div>
);

const SectionHeading = ({ title, description }) => (
  <div style={{ marginBottom: 'var(--space-3)' }}>
    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'var(--font-weight-bold)' }}>{title}</h3>
    {description && (
      <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
        {description}
      </p>
    )}
  </div>
);

// Categories come only from the month-filtered expense records returned by the API.
const getExpenseCategoryBreakdown = (expenses) => {
  if (!Array.isArray(expenses)) return [];

  const byCategory = new Map();
  expenses.forEach((expense) => {
    if (!expense?.category) return;

    const category = String(expense.category);
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount)) return;

    const current = byCategory.get(category) || { category, total: 0 };
    current.total += amount;
    byCategory.set(category, current);
  });

  return Array.from(byCategory.values()).sort((left, right) => right.total - left.total);
};

// The API returns a complete department aggregate for the selected range.
// These sums are presentation-only billing/case measures; collections remain
// the API's transaction-date totalIncome.
const getCaseSplitTotals = (caseSplit) => {
  if (!Array.isArray(caseSplit)) return null;

  const totals = {
    billedCases: 0,
    billed: 0,
    paidToDate: 0,
    due: 0
  };
  const known = {
    billedCases: true,
    billed: true,
    paidToDate: true,
    due: true
  };

  caseSplit.forEach((entry) => {
    [
      ['billedCases', entry?.count],
      ['billed', entry?.billed],
      ['paidToDate', entry?.collected],
      ['due', entry?.due]
    ].forEach(([key, value]) => {
      if (!hasValue(value)) {
        known[key] = false;
        return;
      }
      totals[key] += Number(value);
    });
  });

  Object.keys(known).forEach((key) => {
    if (!known[key]) totals[key] = undefined;
  });
  return totals;
};

const MonthlyBusiness = () => {
  const [monthValue, setMonthValue] = useState(getLocalMonthValue);
  const [report, setReport] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 0 });

  const [reportLoading, setReportLoading] = useState(false);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [expensesError, setExpensesError] = useState(null);
  const [transactionsError, setTransactionsError] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [exportNotice, setExportNotice] = useState('');
  const [exporting, setExporting] = useState('');
  const exportInFlightRef = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const { page, limit, goToPage, setPage } = usePagination(1, 10);

  const monthRange = useMemo(() => getMonthRange(monthValue), [monthValue]);

  useEffect(() => {
    let active = true;
    setReport(null);
    setExpenses(null);
    setReportError(null);
    setExpensesError(null);

    if (!monthRange) {
      setReportLoading(false);
      setExpensesLoading(false);
      return () => {
        active = false;
      };
    }

    setReportLoading(true);
    setExpensesLoading(true);

    Promise.allSettled([
      getDailyBusiness(monthRange.startDate, monthRange.endOfDay),
      getExpenses({ startDate: monthRange.startDate, endDate: monthRange.endDate })
    ]).then(([reportResult, expenseResult]) => {
      if (!active) return;

      if (
        reportResult.status === 'fulfilled' &&
        reportResult.value?.success &&
        reportResult.value.data &&
        typeof reportResult.value.data === 'object' &&
        !Array.isArray(reportResult.value.data)
      ) {
        setReport(reportResult.value.data);
      } else {
        setReportError(
          getApiErrorMessage(
            reportResult.status === 'rejected' ? reportResult.reason : null,
            'Failed to load the monthly business report.'
          )
        );
      }

      if (
        expenseResult.status === 'fulfilled' &&
        expenseResult.value?.success &&
        Array.isArray(expenseResult.value.data)
      ) {
        setExpenses(expenseResult.value.data);
      } else {
        setExpensesError(
          getApiErrorMessage(
            expenseResult.status === 'rejected' ? expenseResult.reason : null,
            'Failed to load expenses for the selected month.'
          )
        );
      }
    }).finally(() => {
      if (active) {
        setReportLoading(false);
        setExpensesLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [monthRange, refreshKey]);

  useEffect(() => {
    let active = true;
    setTransactions([]);
    setPagination({ total: 0, page: 1, limit, pages: 0 });
    setTransactionsError(null);

    if (!monthRange) {
      setTransactionsLoading(false);
      return () => {
        active = false;
      };
    }

    setTransactionsLoading(true);
    getTransactions({
      startDate: monthRange.startDate,
      endDate: monthRange.endDate,
      search: debouncedSearch || undefined,
      type: transactionType || undefined,
      paymentMethod: paymentMethod || undefined,
      page,
      limit
    }).then((response) => {
      if (!active) return;

      if (
        response?.success &&
        response.data &&
        typeof response.data === 'object' &&
        Array.isArray(response.data.transactions)
      ) {
        setTransactions(response.data.transactions);
        setPagination(response.data.pagination || { total: 0, page, limit, pages: 0 });
      } else {
        setTransactionsError('The transaction service returned an unsuccessful response.');
      }
    }).catch((error) => {
      if (active) {
        setTransactionsError(
          getApiErrorMessage(error, 'Failed to load transactions for the selected month.')
        );
      }
    }).finally(() => {
      if (active) setTransactionsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [monthRange, debouncedSearch, paymentMethod, transactionType, page, limit, refreshKey]);

  const paymentModes = useMemo(() => {
    const modes = new Set();
    if (report?.incomeSplit && typeof report.incomeSplit === 'object' && !Array.isArray(report.incomeSplit)) {
      Object.keys(report.incomeSplit).forEach((mode) => modes.add(mode));
    }
    transactions.forEach((transaction) => {
      if (transaction?.paymentMethod) modes.add(String(transaction.paymentMethod));
    });
    return Array.from(modes).map((mode) => ({ value: mode, label: mode }));
  }, [report, transactions]);

  const dailyOverview = useMemo(() => {
    if (!Array.isArray(report?.monthlyOverview) || !monthRange) return [];
    return report.monthlyOverview.filter((entry) => {
      const date = entry?.date ? String(entry.date) : '';
      return date.slice(0, 7) === monthRange.startDate.slice(0, 7);
    });
  }, [report, monthRange]);

  const expenseCategories = useMemo(() => getExpenseCategoryBreakdown(expenses), [expenses]);
  const caseTotals = useMemo(() => getCaseSplitTotals(report?.caseSplit), [report]);
  const hasReportActivity = Boolean(
    report &&
      ((Array.isArray(report.transactions) && report.transactions.length > 0) ||
        (Array.isArray(report.caseSplit) && report.caseSplit.length > 0) ||
        (Array.isArray(report.cashierWise) && report.cashierWise.length > 0) ||
        (Array.isArray(expenses) && expenses.length > 0) ||
        (hasValue(report.totalIncome) && Number(report.totalIncome) !== 0) ||
        (hasValue(report.totalRefunds) && Number(report.totalRefunds) !== 0) ||
        (hasValue(report.totalExpenses) && Number(report.totalExpenses) !== 0) ||
        (hasValue(report.netIncome) && Number(report.netIncome) !== 0))
  );

  const clearReportData = () => {
    setReport(null);
    setExpenses(null);
    setReportError(null);
    setExpensesError(null);
  };

  const clearTransactionData = () => {
    setTransactions([]);
    setTransactionsError(null);
    setPagination({ total: 0, page: 1, limit, pages: 0 });
  };

  const handleMonthChange = (event) => {
    clearReportData();
    clearTransactionData();
    setMonthValue(event.target.value);
    setExportError(null);
    setExportNotice('');
    setSearch('');
    setPaymentMethod('');
    setTransactionType('');
    setPage(1);
  };

  const handleRefresh = () => {
    clearReportData();
    clearTransactionData();
    setExportError(null);
    setExportNotice('');
    setRefreshKey((value) => value + 1);
  };

  const handleExport = async (dataset) => {
    if (!monthRange || exportInFlightRef.current) return;

    exportInFlightRef.current = true;
    setExporting(dataset);
    setExportError(null);
    setExportNotice('');
    try {
      const result = await downloadServerCsv(dataset, {
        startDate: monthRange.startDate,
        endDate: monthRange.endDate
      });
      setExportNotice(`CSV download started: ${result.filename}`);
    } catch (error) {
      setExportError(
        getApiErrorMessage(error, `Failed to export ${dataset} for the selected month.`)
      );
    } finally {
      exportInFlightRef.current = false;
      setExporting('');
    }
  };

  const dailyCollectionData = dailyOverview
    .filter((entry) => hasValue(entry?.income))
    .map((entry) => ({ label: String(entry.date).slice(8, 10), value: Number(entry.income) }));
  const dailyNetData = dailyOverview
    .filter((entry) => hasValue(entry?.net))
    .map((entry) => ({ label: String(entry.date).slice(8, 10), value: Number(entry.net) }));
  const dailyExpenseData = dailyOverview
    .filter((entry) => hasValue(entry?.expenses))
    .map((entry) => ({ label: String(entry.date).slice(8, 10), value: Number(entry.expenses) }));

  return (
    <div>
      <PageHeader
        title="Monthly Business"
        subtitle="Server-backed monthly collections, expenses, case activity, and ledger details"
        action={
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>
              Print
            </Button>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={handleRefresh}>
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              loading={exporting === 'transactions'}
              disabled={!monthRange || Boolean(exporting)}
              onClick={() => handleExport('transactions')}
            >
              Export month transactions (CSV)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              loading={exporting === 'expenses'}
              disabled={!monthRange || Boolean(exporting)}
              onClick={() => handleExport('expenses')}
            >
              Export month expenses (CSV)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              loading={exporting === 'bills'}
              disabled={!monthRange || Boolean(exporting)}
              onClick={() => handleExport('bills')}
            >
              Export month bills (CSV)
            </Button>
          </div>
        }
      />

      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-4)'
        }}
      >
        <div style={{ minWidth: '220px' }}>
          <Input
            id="monthly-business-month"
            label="Reporting month"
            type="month"
            value={monthValue}
            onChange={handleMonthChange}
            required
            style={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase' }}>
            Selected period
          </span>
          <strong style={{ fontSize: 'var(--font-size-lg)' }}>
            {monthRange?.label || 'Select a valid month'}
          </strong>
        </div>
      </div>

      {monthRange && (
        <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          CSV exports cover matching server records in the selected month, up to the backend's 5,000-row cap. The visible transaction search, type, payment method, and pagination filters are not supported by the export endpoint.
        </p>
      )}

      {!monthRange && (
        <div role="alert" className="form-error" style={{ marginBottom: 'var(--space-4)' }}>
          Select a valid month to load business activity.
        </div>
      )}
      {exportError && <ErrorBanner message={exportError} />}
      {exportNotice && (
        <div role="status" style={{ marginBottom: 'var(--space-4)', color: 'var(--color-success)', fontSize: 'var(--font-size-sm)' }}>
          {exportNotice}
        </div>
      )}

      {monthRange && reportLoading && (
        <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <LoadingSpinner label="Loading monthly business summary..." />
        </div>
      )}

      {monthRange && !reportLoading && reportError && (
        <ErrorBanner message={reportError} onRetry={handleRefresh} />
      )}

      {monthRange && report && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-4)'
            }}
          >
            <StatCard title="Collections" value={formatApiCurrency(report.totalIncome)} color="var(--color-success)" bgColor="var(--color-success-bg)" />
            <StatCard title="Billed amount" value={formatApiCurrency(caseTotals?.billed)} />
            <StatCard title="Paid to date" value={formatApiCurrency(caseTotals?.paidToDate)} color="var(--color-success)" bgColor="var(--color-success-bg)" />
            <StatCard title="Current due" value={formatApiCurrency(caseTotals?.due)} color="var(--color-danger)" bgColor="var(--color-danger-bg)" />
            <StatCard title="Billed cases" value={formatApiCount(caseTotals?.billedCases)} />
            <StatCard title="Expenses" value={formatApiCurrency(report.totalExpenses)} color="var(--color-danger)" bgColor="var(--color-danger-bg)" />
            <StatCard title="Refunds" value={formatApiCurrency(report.totalRefunds)} color="var(--color-warning)" bgColor="var(--color-warning-bg)" />
            <StatCard title="Net income" value={formatApiCurrency(report.netIncome)} />
            <StatCard title="Monthly transaction records" value={formatApiCount(Array.isArray(report.transactions) ? report.transactions.length : undefined)} />
            <StatCard title="Expense records" value={formatApiCount(expenses === null ? undefined : expenses.length)} />
          </div>
          <p style={{ margin: '-4px 0 var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
            Collections are transaction-date income. Billed amount, paid-to-date, billed cases, and current due are totals derived from the API&apos;s complete department split for bills dated in this month.
          </p>

          {!hasReportActivity && (
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
              <EmptyState
                title="No business activity"
                message={`The API returned no collections, expenses, or case activity for ${monthRange.label}.`}
              />
            </div>
          )}

          <section className="card" style={{ marginBottom: 'var(--space-4)', overflowX: 'auto' }}>
            <SectionHeading
              title="Daily business trend"
              description="Only daily points returned by the business API for the selected month are shown."
            />
            {dailyCollectionData.length === 0 && dailyNetData.length === 0 && dailyExpenseData.length === 0 ? (
              <EmptyState
                title="No daily trend data"
                message="The current business API did not return daily trend points for this month."
              />
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-5)', minWidth: '320px' }}>
                {dailyCollectionData.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-sm)' }}>Collections by day</h4>
                    <SvgBars data={dailyCollectionData} height={190} />
                  </div>
                )}
                {dailyNetData.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-sm)' }}>Net income by day</h4>
                    <SvgLine data={dailyNetData} height={190} />
                  </div>
                )}
                {dailyExpenseData.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-sm)' }}>Expenses by day</h4>
                    <SvgBars data={dailyExpenseData} height={190} color="var(--color-danger)" />
                  </div>
                )}
              </div>
            )}
            {dailyOverview.length > 0 && (
              <div style={{ marginTop: 'var(--space-5)' }}>
                <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-sm)' }}>Returned daily points</h4>
                <DataTable
                  headers={['Date', 'Collections', 'Refunds', 'Expenses', 'Net']}
                  data={dailyOverview}
                  emptyMessage="No daily points were returned."
                  renderRow={(entry) => (
                    <tr key={entry.date}>
                      <td>{String(entry.date).slice(0, 10)}</td>
                      <td>{formatApiCurrency(entry.income)}</td>
                      <td>{formatApiCurrency(entry.refunds)}</td>
                      <td>{formatApiCurrency(entry.expenses)}</td>
                      <td>{formatApiCurrency(entry.net)}</td>
                    </tr>
                  )}
                />
              </div>
            )}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <section className="card">
              <SectionHeading
                title="Collections by payment mode"
                description="Mode names and amounts are taken directly from the API response."
              />
              {report.incomeSplit && typeof report.incomeSplit === 'object' && !Array.isArray(report.incomeSplit) && Object.keys(report.incomeSplit).length > 0 ? (
                <DataTable
                  headers={['Payment mode', 'Collection']}
                  data={Object.entries(report.incomeSplit).map(([mode, amount]) => ({ mode, amount }))}
                  emptyMessage="No payment-mode breakdown was returned."
                  renderRow={(entry) => (
                    <tr key={entry.mode}>
                      <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{entry.mode}</td>
                      <td style={{ fontWeight: 'var(--font-weight-bold)' }}>{formatApiCurrency(entry.amount)}</td>
                    </tr>
                  )}
                />
              ) : (
                <EmptyState title="No payment-mode data" message="No collection breakdown is available for this month." />
              )}
            </section>

            <section className="card">
              <SectionHeading
                title="Cashier-wise collections"
                description="Server-grouped income by the user who received it."
              />
              {Array.isArray(report.cashierWise) && report.cashierWise.length > 0 ? (
                <DataTable
                  headers={['Cashier / user', 'Collections', 'Transactions']}
                  data={report.cashierWise}
                  emptyMessage="No cashier activity was returned."
                  renderRow={(cashier) => (
                    <tr key={cashier.userId || cashier.name}>
                      <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{cashier.name || '—'}</td>
                      <td>{formatApiCurrency(cashier.income)}</td>
                      <td>{formatApiCount(cashier.count)}</td>
                    </tr>
                  )}
                />
              ) : (
                <EmptyState title="No cashier data" message="No cashier-wise activity is available for this month." />
              )}
            </section>
          </div>

          {Array.isArray(report.caseSplit) && report.caseSplit.length > 0 && (
            <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
              <SectionHeading
                title="Billed case activity by department"
                description="Counts, billed amounts, paid-to-date amounts, and current dues below are the server-provided department totals for bills dated in this month."
              />
              <DataTable
                headers={['Department', 'Billed cases', 'Billed', 'Paid to date', 'Current due']}
                data={report.caseSplit}
                emptyMessage="No department activity was returned."
                renderRow={(entry) => (
                  <tr key={entry.department}>
                    <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{entry.department || '—'}</td>
                    <td>{formatApiCount(entry.count)}</td>
                    <td>{formatApiCurrency(entry.billed)}</td>
                    <td style={{ color: 'var(--color-success)' }}>{formatApiCurrency(entry.collected)}</td>
                    <td style={{ color: 'var(--color-danger)' }}>{formatApiCurrency(entry.due)}</td>
                  </tr>
                )}
              />
            </section>
          )}
        </>
      )}

      <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <SectionHeading
          title="Expenses"
          description={monthRange ? `Expense records returned for ${monthRange.label}.` : 'Select a month to view expenses.'}
        />
        {monthRange && expensesError && <ErrorBanner message={expensesError} onRetry={handleRefresh} />}
        {monthRange && !expensesError && expensesLoading && (
          <LoadingSpinner label="Loading monthly expenses..." />
        )}
        {monthRange && !expensesError && !expensesLoading && expenses?.length === 0 && (
          <EmptyState title="No expenses recorded" message="The API returned no expense records for the selected month." />
        )}
        {monthRange && !expensesError && !expensesLoading && expenses?.length > 0 && (
          <>
            {expenseCategories.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-sm)' }}>Category breakdown</h4>
                <DataTable
                  headers={['Category', 'Selected-month total']}
                  data={expenseCategories}
                  emptyMessage="No expense categories were returned."
                  renderRow={(entry) => (
                    <tr key={entry.category}>
                      <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{entry.category}</td>
                      <td>{formatApiCurrency(entry.total)}</td>
                    </tr>
                  )}
                />
              </div>
            )}
            <DataTable
              headers={['Date', 'Category', 'Description', 'Payment mode', 'Amount']}
              data={expenses}
              emptyMessage="No expenses recorded."
              renderRow={(expense) => (
                <tr key={expense._id}>
                  <td>{formatDate(expense.date)}</td>
                  <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{expense.category || '—'}</td>
                  <td>{expense.description || '—'}</td>
                  <td>{expense.paymentMethod ? <StatusBadge status={expense.paymentMethod} /> : '—'}</td>
                  <td style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-danger)' }}>{formatApiCurrency(expense.amount)}</td>
                </tr>
              )}
            />
          </>
        )}
      </section>

      <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <SectionHeading
          title="Detailed transactions"
          description="Server-paginated transaction records for the selected month."
        />
        {monthRange && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            <Select
              name="monthly-transaction-type"
              label="Transaction type"
              value={transactionType}
              onChange={(event) => {
                clearTransactionData();
                setTransactionType(event.target.value);
                setPage(1);
              }}
              options={TRANSACTION_TYPE_FILTERS.map((type) => ({ value: type, label: type }))}
              placeholder="All types"
              style={{ minWidth: '160px', marginBottom: 0 }}
            />
            <Select
              name="monthly-payment-method"
              label="Payment mode"
              value={paymentMethod}
              onChange={(event) => {
                clearTransactionData();
                setPaymentMethod(event.target.value);
                setPage(1);
              }}
              options={paymentModes}
              placeholder="All modes"
              style={{ minWidth: '160px', marginBottom: 0 }}
            />
          </div>
        )}
        {monthRange && transactionsError && <ErrorBanner message={transactionsError} onRetry={handleRefresh} />}
        {monthRange && !transactionsError && (
          <DataTable
            headers={['Date & time', 'Patient / registration', 'Bill', 'Type', 'Payment mode', 'Received by', 'Amount']}
            data={transactions}
            loading={transactionsLoading}
            emptyMessage="No transactions matched the selected filters."
            searchValue={search}
            onSearchChange={(event) => {
              clearTransactionData();
              setSearch(event.target.value);
              setPage(1);
            }}
            searchPlaceholder="Search patient name or registration number..."
            pagination={{
              total: pagination.total || 0,
              page: pagination.page || page,
              limit: pagination.limit || limit,
              pages: pagination.pages || 0,
              onPageChange: goToPage
            }}
            renderRow={(transaction, index) => {
              const transactionAmount = formatApiCurrency(transaction.amount);
              const displayedAmount = transaction.type === 'Refund' && transactionAmount !== '—'
                ? `−${transactionAmount}`
                : transactionAmount;
              return (
                <tr key={transaction._id || `${transaction.date}-${index}`}>
                  <td>{formatDate(transaction.date)}</td>
                  <td>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{transaction.patient?.name || '—'}</div>
                    <small style={{ color: 'var(--color-text-muted)' }}>{transaction.patient?.registrationNumber || 'No registration number'}</small>
                  </td>
                  <td>{transaction.bill?.billNumber || '—'}</td>
                  <td>{transaction.type ? <StatusBadge status={transaction.type} /> : '—'}</td>
                  <td>{transaction.paymentMethod || '—'}</td>
                  <td>{transaction.receivedBy?.name || '—'}</td>
                  <td style={{ fontWeight: 'var(--font-weight-bold)', color: transaction.type === 'Refund' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {displayedAmount}
                  </td>
                </tr>
              );
            }}
          />
        )}
      </section>

      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
        Monthly patient registrations, test executions, and a selected-period previous-month comparison are not exposed by the current range APIs and are not derived here. Billed cases represent non-voided Bill records; a unified monthly USG/X-ray/modality case count is not available. Expense categories are grouped only from actual expense records returned for the selected month; the overall expense total remains the API-provided value.
      </p>
    </div>
  );
};

export default MonthlyBusiness;
