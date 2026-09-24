import React, { useState, useEffect } from 'react';
import { getXrayCases } from '../../services/xrayService';
import useDebounce from '../../hooks/useDebounce';
import formatDate from '../../utils/formatDate';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { DataTable, PageHeader, Button, StatusBadge } from '../../components/common';
import '../../styles/Xray.css';

/* Surfaces only the backend's user-facing `message` field (never stack traces),
   with sensible fallbacks per failure type (same mapping as the other lab
   screens). */
const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    const status = err.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
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

const SearchXrayCases = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  // A failed search must read as an error — never as "no matches found".
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await getXrayCases({ search: debouncedSearch });
      if (res.success) {
        setCases(res.data);
        setLoadError(null);
      }
    } catch (err) {
      setCases([]);
      setLoadError(getApiErrorMessage(err, 'Failed to search X-Ray cases.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [debouncedSearch]);

  return (
    <div>
      <PageHeader
        title="Search X-Ray Case Files"
        subtitle="Look up historical digital radiograph records by patient name"
      />

      {loadError && (
        <div className="xray-banner xray-banner-error" role="alert">
          <AlertTriangle size={16} />
          <span>{loadError}</span>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={() => fetchCases()}
          >
            Retry
          </Button>
        </div>
      )}

      <DataTable
        headers={['Date', 'Registration No', 'Patient Name', 'Referring Doctor', 'Findings Description', 'Status']}
        data={cases}
        loading={loading}
        emptyMessage="No X-Ray cases matched your search query."
        searchValue={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        searchPlaceholder="Type patient name..."
        renderRow={(c) => (
          <tr key={c._id}>
            <td>{formatDate(c.date).split(',')[0]}</td>
            <td style={{ fontWeight: '600' }}>{c.patient?.registrationNumber}</td>
            <td style={{ fontWeight: '600' }}>{c.patient?.name}</td>
            <td>{c.referringDoctor?.name || 'Self'}</td>
            <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.findings}
            </td>
            <td>
              <StatusBadge status={c.status} />
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default SearchXrayCases;
