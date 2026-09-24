import React, { useState, useEffect, useMemo } from 'react';
import { getReferralReport } from '../../services/dashboardService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import useClientPagination from '../../hooks/useClientPagination';
import { Eye, FileSpreadsheet, Printer } from 'lucide-react';
import { PageHeader, DataTable, DatePicker, Modal, Button } from '../../components/common';

const ReferralBusiness = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search + client-side pagination over the aggregated doctor rows.
  const [search, setSearch] = useState('');
  const filteredReport = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return report;
    return report.filter((r) =>
      String(r.doctorName || '').toLowerCase().includes(q) ||
      String(r.contact || r.clinicHospital || '').toLowerCase().includes(q)
    );
  }, [report, search]);
  const pg = useClientPagination(filteredReport, 10);

  // View details modal
  const [detailsTarget, setDetailsTarget] = useState(null);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const res = await getReferralReport(startDate, endDate);
      if (res.success) {
        setReport(res.data);
      }
    } catch (err) {
      console.error('Failed to load referral report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, [startDate, endDate]);

  const setPreset = (p) => {
    const fmt = (d) => d.toISOString().split('T')[0];
    const now = new Date();
    if (p === 'Today') { setStartDate(fmt(now)); setEndDate(fmt(now)); }
    else if (p === 'Yesterday') { const y = new Date(); y.setDate(now.getDate() - 1); setStartDate(fmt(y)); setEndDate(fmt(y)); }
    else if (p === 'Last Week') { const s = new Date(); s.setDate(now.getDate() - 6); setStartDate(fmt(s)); setEndDate(fmt(now)); }
    else if (p === 'Custom') { /* keep dates */ }
    else {
      // Month names: September / August / July
      const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
      const m = months[p.toLowerCase()];
      if (m !== undefined) {
        const y = now.getFullYear();
        setStartDate(fmt(new Date(y, m, 1)));
        setEndDate(fmt(new Date(y, m + 1, 0)));
      }
    }
  };

  const downloadCsv = () => {
    const rows = [['S.NO','REFERRER ID','NAME','CONTACT','TOTAL CASES','CASES IN FILTER']];
    report.forEach((r, i) => rows.push([i + 1, r.doctorId, r.doctorName, r.contact || '', r.totalCases || r.billsCount, r.billsCount]));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `referral-cases-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div>
      <PageHeader
        title="Referreral Doctor Wise Report"
        subtitle="Filter by period, download cases data, print business — Labsmart parity"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="sm" onClick={downloadCsv}>Download cases data</Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()} icon={<Printer size={14} />}>Print</Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>Print Business</Button>
          </div>
        }
      />

      <div className="card" style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Filter by period:</span>
        {['Today', 'Yesterday', 'Last Week', 'September', 'August', 'July', 'Custom'].map((p) => (
          <button key={p} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setPreset(p)}>{p}</button>
        ))}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Watch Video: referral reports = bills grouped by doctor in range</span>
      </div>

      {/* Date Filters */}
      <div className="card" style={{ display: 'flex', gap: '16px', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <DatePicker
          label="From Date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{ marginBottom: 0, minWidth: '180px' }}
        />
        <DatePicker
          label="To Date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{ marginBottom: 0, minWidth: '180px' }}
        />
      </div>

      <DataTable
        headers={['S.No.', 'Referrer ID', 'Name', 'Contact', 'Total Cases', 'Cases In Filter', 'Commission %', 'Gross', 'Share Payable', 'Case Details']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No referral doctor billing generated in selected range."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); pg.reset(); }}
        searchPlaceholder="Search doctor…"
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(item, idx) => (
          <tr key={item.doctorId}>
            <td>{(pg.page - 1) * pg.limit + idx + 1}</td>
            <td style={{ fontFamily: 'monospace' }}>{String(item.doctorId).slice(-6).toUpperCase()}</td>
            <td style={{ fontWeight: '600' }}>{item.doctorName}</td>
            <td>{item.contact || item.clinicHospital || '—'}</td>
            <td>{item.totalCases || item.billsCount}</td>
            <td style={{ fontWeight: 700 }}>{item.billsCount}</td>
            <td style={{ fontWeight: '600' }}>{item.commissionPercentage}%</td>
            <td>{formatCurrency(item.totalBillsAmount)}</td>
            <td style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
              {formatCurrency(item.totalCommission)}
            </td>
            <td>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => setDetailsTarget(item)}
              >
                <Eye size={14} /> View Cases ({item.billsCount})
              </button>
            </td>
          </tr>
        )}
      />

      {/* Details Modal */}
      <Modal
        isOpen={!!detailsTarget}
        onClose={() => setDetailsTarget(null)}
        title={`Billing Cases for ${detailsTarget?.doctorName}`}
      >
        {detailsTarget && (
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Clinic: <strong>{detailsTarget.clinicHospital || 'Walk-in'}</strong> | Commission Rate: <strong>{detailsTarget.commissionPercentage}%</strong>
            </p>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.825rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                    <th style={{ padding: '8px' }}>Date</th>
                    <th style={{ padding: '8px' }}>Patient</th>
                    <th style={{ padding: '8px' }}>Bill Number</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsTarget.billsList?.map((bill, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px' }}>{formatDate(bill.date).split(',')[0]}</td>
                      <td style={{ padding: '8px', fontWeight: '500' }}>{bill.patientName}</td>
                      <td style={{ padding: '8px' }}>{bill.billNumber}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(bill.amount)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: 'var(--primary-color)' }}>
                        {formatCurrency(bill.commissionAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReferralBusiness;
