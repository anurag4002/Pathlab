import React, { useState, useEffect } from 'react';
import { getXrayCases } from '../../services/xrayService';
import useDebounce from '../../hooks/useDebounce';
import formatDate from '../../utils/formatDate';
import { Search } from 'lucide-react';
import { DataTable, PageHeader, StatusBadge } from '../../components/common';

const SearchXrayCases = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await getXrayCases({ search: debouncedSearch });
      if (res.success) {
        setCases(res.data);
      }
    } catch (err) {
      console.error('Failed to search X-Ray cases', err);
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
