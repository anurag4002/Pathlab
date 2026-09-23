import React, { useState, useEffect, useMemo } from 'react';
import { getTransactions } from '../../services/transactionService';
import { getDailyBusiness } from '../../services/dashboardService';
import { PageHeader, DatePicker } from '../../components/common';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';
import { usePermissions } from '../../hooks/usePermission';
import TransactionTable from './components/TransactionTable';
import ModeFilter from './components/ModeFilter';
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
  const { page, limit, goToPage } = usePagination(1, 20);
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

  return (
    <div>
      <PageHeader title="Cashbook" subtitle="Cash in / out for a date window, reconciled against the business ledger" />
      {!canView && (
        <p style={{ fontSize: '0.82rem', color: 'var(--color-warning, #a16207)' }}>
          Your role has no finance permission — this view is cosmetic; the server still enforces access.
        </p>
      )}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <DatePicker label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ marginBottom: 0 }} />
        <DatePicker label="To" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ marginBottom: 0 }} />
        <ModeFilter mode={mode} setMode={(v) => { setMode(v); goToPage(1); }} type={type} setType={(v) => { setType(v); goToPage(1); }} onReset={() => { setMode(''); setType(''); }} />
      </div>
      {dateError && <p className="form-error" style={{ marginBottom: '1rem' }}>{dateError}</p>}
      <CashSummaryCards income={income} refunds={refunds} net={net} count={paginationInfo.total || transactions.length} />
      <div className="card" style={{ padding: '10px 14px', marginBottom: '1rem', fontSize: '0.82rem' }}>
        {ledgerIncome === null ? (
          <span style={{ color: 'var(--text-muted)' }}>Ledger comparison unavailable for this window.</span>
        ) : reconciled ? (
          <span style={{ color: 'var(--color-success)' }}>Reconciled: cashbook cash-in matches ledger collections for this period.</span>
        ) : (
          <span style={{ color: 'var(--color-danger)' }}>
            Reconcile note: cashbook cash-in differs from ledger collections for this period
            (filters/pagination may exclude rows) — verify before closing the day.
          </span>
        )}
      </div>
      <TransactionTable
        transactions={transactions}
        loading={loading}
        search={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        pagination={{ total: paginationInfo.total, page, limit, pages: paginationInfo.pages }}
        goToPage={goToPage}
      />
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
        Note: manual cash in/out entry is omitted — no backend endpoint exists for it.
      </p>
    </div>
  );
};

export default Cashbook;
