import React, { useState, useEffect } from 'react';
import { getBills } from '../../services/billService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import { PageHeader, DataTable, DatePicker, StatusBadge } from '../../components/common';

const CaseWiseReport = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { page, limit, goToPage } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });

  const fetchCasesReport = async () => {
    setLoading(true);
    try {
      const res = await getBills({
        search: debouncedSearch,
        startDate,
        endDate,
        page,
        limit
      });
      if (res.success) {
        setBills(res.data.bills);
        setPaginationInfo(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load case wise reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCasesReport();
  }, [debouncedSearch, startDate, endDate, page, limit]);

  return (
    <div>
      <PageHeader
        title="Case Wise Bill Report"
        subtitle="Consolidated listing of diagnostic case registrations, referral details, and billing stats"
      />

      {/* Date Filters */}
      <div className="card" style={{ display: 'flex', gap: '16px', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <DatePicker
          label="From Date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            goToPage(1);
          }}
          style={{ marginBottom: 0, minWidth: '180px' }}
        />
        <DatePicker
          label="To Date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            goToPage(1);
          }}
          style={{ marginBottom: 0, minWidth: '180px' }}
        />
      </div>

      <DataTable
        headers={['Invoice Ref', 'Patient Reg Code', 'Patient Name', 'Age / Gender', 'Referred By', 'Registered Date', 'Gross Price', 'Status']}
        data={bills}
        loading={loading}
        emptyMessage="No diagnostic cases found for the selected date range."
        searchValue={search}
        onSearchChange={(e) => {
          setSearch(e.target.value);
          goToPage(1);
        }}
        searchPlaceholder="Search by invoice number..."
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage
        }}
        renderRow={(bill) => (
          <tr key={bill._id}>
            <td style={{ fontWeight: '600' }}>{bill.billNumber}</td>
            <td style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{bill.patient?.registrationNumber}</td>
            <td>{bill.patient?.name || 'Walk-in Patient'}</td>
            <td>{bill.patient?.age} / {bill.patient?.gender}</td>
            <td>{bill.referringDoctor?.name || 'Self'}</td>
            <td>{formatDate(bill.date).split(',')[0]}</td>
            <td style={{ fontWeight: '600' }}>{formatCurrency(bill.totalAmount)}</td>
            <td>
              <StatusBadge status={bill.paymentStatus} />
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default CaseWiseReport;
