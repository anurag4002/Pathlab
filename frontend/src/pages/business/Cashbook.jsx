import React, { useState, useEffect, useMemo } from 'react';
import { getTransactions } from '../../services/transactionService';
import { getDailyBusiness } from '../../services/dashboardService';
import { PageHeader, AdvancedFilterBar, Button } from '../../components/common';
import { Printer } from 'lucide-react';
import printReport, { fetchAllPages } from '../../utils/printReport';
import { money, dateTimeLabel, periodLabel, sum } from '../../utils/reportFormat';
import { notify } from '../../components/common/Toast/toast';
import { PAYMENT_METHODS } from '../../constants/billConstants';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';
import { usePermissions } from '../../hooks/usePermission';
import TransactionTable from './components/TransactionTable';
import CashSummaryCards from './components/CashSummaryCards';

// Phase 18 — Cashbook page.
// Server has no dedicated cashbook/manual-entry endpoint
// (GET /api/bills/cashbook does not exist; no manual cash in/out API),
// so this page is built on GET /transactions + the daily-business ledger
// for reconciliation. Manual-entry UI is deliberately omitted.
const Cashbook = () => {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [dateError, setDateError] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [mode, setMode] = useState('');
  const [type, setType] = useState('');
  const { page, limit, goToPage, setLimit } = usePagination(1, 20);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });
  const { can } = usePermissions();
  const canView = can('finance') || can('billing');

  const rangeValid = useMemo(() => {
    if (!startDate || !endDate) return false;
    return startDate <= endDate;
  }, [startDate, endDate]);

  useEffect(() => {
    setDateError(rangeValid ? '' : 'Start date must be on or before the end date.');
  }, [rangeValid]);

  const fetchAll = async () => {
    if (!rangeValid) return;
    setLoading(true);
    try {
      const [txRes, bizRes] = await Promise.all([
        getTransactions({
          search: debouncedSearch || undefined,
          paymentMethod: mode || undefined,
          type: type || undefined,
          startDate, endDate, page, limit,
        }).catch(() => null),
        getDailyBusiness(startDate, endDate).catch(() => null),
      ]);
      if (txRes?.success) {
        setTransactions(txRes.data.transactions || txRes.data || []);
        if (txRes.data.pagination) setPaginationInfo(txRes.data.pagination);
      }
      if (bizRes?.success) setLedger(bizRes.data);
    } catch (e) {
      console.error('Failed to load cashbook', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    goToPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, mode, type, startDate, endDate]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, mode, type, page, limit, startDate, endDate]);

  const income = transactions.filter((t) => t.type !== 'Refund').reduce((s, t) => s + Number(t.amount || 0), 0);
  const refunds = transactions.filter((t) => t.type === 'Refund').reduce((s, t) => s + Number(t.amount || 0), 0);
  const net = income - refunds;
  const ledgerIncome = ledger?.totalIncome ?? null;
  const reconciled = ledgerIncome === null ? null : Math.abs(Number(ledgerIncome) - income) < 1;

  // Print: every payment and refund for the filters (all pages).
  const [printing, setPrinting] = useState(false);
  const printCashbook = async () => {
    setPrinting(true);
    try {
      const all = await fetchAllPages(async (p, size) => {
        const res = await getTransactions({ search: debouncedSearch || undefined, paymentMethod: mode || undefined, type: type || undefined, startDate, endDate, page: p, limit: size });
        return { items: res?.data?.transactions || [], pages: res?.data?.pagination?.pages || 1 };
      }, { pageSize: 200 });
      const ins = all.filter((t) => t.type !== 'Refund');
      const outs = all.filter((t) => t.type === 'Refund');
      const modes = [...new Set(all.map((t) => t.paymentMethod || 'Other'))];
      await printReport({
        title: 'Cashbook',
        period: periodLabel(startDate, endDate),
        filters: [mode && `Mode: ${mode}`, type && `Type: ${type}`, debouncedSearch && `Search: ${debouncedSearch}`],
        summary: [
          { label: 'Received', value: money(sum(ins, (t) => t.amount)) },
          { label: 'Refunded', value: money(sum(outs, (t) => t.amount)) },
          { label: 'Net', value: money(sum(ins, (t) => t.amount) - sum(outs, (t) => t.amount)) },
          { label: 'Entries', value: String(all.length) },
        ],
        sections: [
          modes.length > 1 && {
            title: 'By payment mode',
            columns: [{ label: 'Mode' }, { label: 'Received', align: 'right' }, { label: 'Refunded', align: 'right' }, { label: 'Net', align: 'right' }],
            rows: modes.map((m) => {
              const got = sum(ins.filter((t) => (t.paymentMethod || 'Other') === m), (t) => t.amount);
              const back = sum(outs.filter((t) => (t.paymentMethod || 'Other') === m), (t) => t.amount);
              return [m, money(got), money(back), money(got - back)];
            }),
          },
          {
            title: 'Entries',
            columns: [{ label: 'Time' }, { label: 'Bill no' }, { label: 'Patient' }, { label: 'Mode' }, { label: 'Received by' }, { label: 'In', align: 'right' }, { label: 'Out', align: 'right' }],
            rows: all.map((t) => [dateTimeLabel(t.date || t.createdAt), t.bill?.billNumber || '', t.patient?.name || 'Walk-in', t.paymentMethod || '', t.receivedBy?.name || '', t.type === 'Refund' ? '' : money(t.amount), t.type === 'Refund' ? money(t.amount) : '']),
            totals: ['Total', '', '', '', '', money(sum(ins, (t) => t.amount)), money(sum(outs, (t) => t.amount))],
            empty: 'No entries in this period.',
          },
        ],
      });
    } catch { notify('Could not prepare the print. Try again.'); } finally { setPrinting(false); }
  };

  return (
    <div>
      <PageHeader title="Cashbook" subtitle="Cash in / out for a date window, reconciled against the business ledger"
        action={<Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={printCashbook} loading={printing}>Print</Button>} />
      {!canView && (
        <p style={{ fontSize: '0.82rem', color: 'var(--color-warning, #a16207)' }}>
          Your role has no finance permission — this view is cosmetic; the server still enforces access.
        </p>
      )}
      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!(mode || type || search)}
        onClear={() => { setMode(''); setType(''); setSearch(''); goToPage(1); }}
        values={{ from: startDate, to: endDate, mode, type, search }}
        onChange={(key, value) => {
          if (key === 'from') setStartDate(value);
          else if (key === 'to') setEndDate(value);
          else if (key === 'mode') { setMode(value); goToPage(1); }
          else if (key === 'type') { setType(value); goToPage(1); }
          else if (key === 'search') { setSearch(value); goToPage(1); }
        }}
        fields={[
          { key: 'from', label: 'From', type: 'date' },
          { key: 'to', label: 'To', type: 'date' },
          {
            key: 'mode',
            label: 'Payment mode',
            type: 'select',
            placeholder: 'All modes',
            options: PAYMENT_METHODS.map((m) => ({ value: m, label: m }))
          },
          {
            key: 'type',
            label: 'Type',
            type: 'select',
            placeholder: 'All types',
            options: [
              { value: 'Income', label: 'Cash in (Income)' },
              { value: 'Refund', label: 'Cash out (Refund)' },
              { value: 'Expense', label: 'Expense' }
            ]
          },
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Search patient / bill no...' }
        ]}
      />
      {dateError && <p className="form-error" style={{ marginBottom: '1rem' }}>{dateError}</p>}
      <CashSummaryCards income={income} refunds={refunds} net={net} count={paginationInfo.total || transactions.length} />
      <div className="card" style={{ padding: '10px 14px', marginBottom: '1rem', fontSize: '0.82rem' }}>
        {ledgerIncome === null ? (
          <span style={{ color: 'var(--text-muted)' }}>Ledger comparison unavailable for this window.</span>
        ) : reconciled ? (
          <span style={{ color: 'var(--color-success)' }}>Reconciled: cashbook cash-in matches ledger collections for this period.</span>
        ) : (
          <span className="callout-warning" role="note">
            <strong>Cash-in does not match the ledger for this period.</strong>{' '}
            Filters or paging may hide some rows - check before closing the day.
          </span>
        )}
      </div>
      <TransactionTable
        transactions={transactions}
        loading={loading}
        pagination={{ total: paginationInfo.total, page, limit, pages: paginationInfo.pages }}
        goToPage={goToPage}
        onLimitChange={setLimit}
      />
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
        Manual cash in/out entry is not available on this screen.
      </p>
    </div>
  );
};

export default Cashbook;
