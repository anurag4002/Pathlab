import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInquiries, setInquiryStatus } from '../../services/inquiryService';
import { DataTable, PageHeader, StatusBadge, Select } from '../../components/common';
import usePagination from '../../hooks/usePagination';
import useDebounce from '../../hooks/useDebounce';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'New', label: 'New' },
  { value: 'Contacted', label: 'Contacted' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Cancelled', label: 'Cancelled' }
];

const NEXT_STATUS = ['New', 'Contacted', 'Confirmed', 'Cancelled'];

// Staff queue for patient-portal booking inquiries. Inquiries carry no bill
// and no payment — staff confirm by phone and bill at the counter.
const Inquiries = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState('');
  const { page, limit, goToPage, setLimit } = usePagination(1, 10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, pages: 0 });
  const [updatingId, setUpdatingId] = useState('');

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getInquiries({
        status: statusFilter || undefined,
        search: debouncedSearch.trim() || undefined,
        page,
        limit
      });
      if (res?.success) {
        setItems(res.data?.inquiries || []);
        setPaginationInfo(res.data?.pagination || { total: 0, pages: 0 });
      }
    } catch (err) {
      console.error('Failed to load inquiries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, page, limit]);

  const changeStatus = async (inq, status) => {
    if (!status || status === inq.status) return;
    setUpdatingId(inq._id);
    try {
      const res = await setInquiryStatus(inq._id, status);
      if (res?.success) fetchList();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update inquiry');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div>
      <PageHeader
        title="Booking Inquiries"
        subtitle="Self-service test bookings from the patient portal — confirm by phone, bill at the counter"
      />

      <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: '11rem', maxWidth: '14rem' }}>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); goToPage(1); }}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      <DataTable
        headers={['Raised On', 'Patient', 'Phone', 'Items', 'Est. Total', 'Preferred', 'Status', 'Actions']}
        data={items}
        loading={loading}
        emptyMessage="No booking inquiries."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); goToPage(1); }}
        searchPlaceholder="Search name or phone…"
        pagination={{
          total: paginationInfo.total,
          page,
          limit,
          pages: paginationInfo.pages,
          onPageChange: goToPage,
          onLimitChange: setLimit
        }}
        renderRow={(inq) => (
          <tr key={inq._id}>
            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(inq.createdAt)}</td>
            <td style={{ fontWeight: '600' }}>
              {inq.name}
              {inq.patient?.registrationNumber && (
                <span style={{ display: 'block', fontWeight: 400, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {inq.patient.registrationNumber}
                </span>
              )}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>{inq.phone}</td>
            <td style={{ maxWidth: '260px' }}>
              {(inq.items || []).map((it, i) => (
                <span key={i} style={{ display: 'block', fontSize: '0.8rem' }}>
                  {it.name} <span style={{ color: 'var(--color-text-muted)' }}>({formatCurrency(it.price)})</span>
                </span>
              ))}
            </td>
            <td style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>
              {formatCurrency((inq.items || []).reduce((s, it) => s + (Number(it.price) || 0), 0))}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>{inq.preferredDate ? formatDate(inq.preferredDate).split(',')[0] : '—'}</td>
            <td><StatusBadge status={inq.status} /></td>
            <td>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={inq.status}
                  disabled={updatingId === inq._id}
                  onChange={(e) => changeStatus(inq, e.target.value)}
                  className="select-control"
                  style={{ maxWidth: '130px', padding: '4px 8px', fontSize: '0.75rem' }}
                  aria-label="Change inquiry status"
                >
                  {NEXT_STATUS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {inq.patient?._id && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => navigate(`/cases/patients/${inq.patient._id}`)}
                  >
                    Patient
                  </button>
                )}
              </div>
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default Inquiries;
