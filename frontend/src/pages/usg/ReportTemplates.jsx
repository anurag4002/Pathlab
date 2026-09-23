import React, { useState, useEffect } from 'react';
import { getUSGTemplates } from '../../services/usgService';
import { PageHeader, DataTable } from '../../components/common';
import useClientPagination from '../../hooks/useClientPagination';

const ReportTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = templates.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(t.name || '').toLowerCase().includes(q) ||
      String(t.findings || '').toLowerCase().includes(q);
  });
  const pg = useClientPagination(filtered, 10);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const res = await getUSGTemplates();
        if (res.success) {
          setTemplates(res.data);
        }
      } catch (err) {
        console.error('Failed to load templates list', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  return (
    <div>
      <PageHeader
        title="USG Clinical Report Templates"
        subtitle="Manage default findings templates for abdominal scan profiles and Obstetric checks"
      />

      <DataTable
        headers={['Template Name', 'Default Findings Text']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No clinical templates defined."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); pg.reset(); }}
        searchPlaceholder="Search templates…"
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
        renderRow={(t, idx) => (
          <tr key={idx}>
            <td style={{ fontWeight: '600', verticalAlign: 'top', width: '220px' }}>{t.name}</td>
            <td>
              <pre style={{ fontFamily: 'inherit', fontSize: '0.825rem', whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>
                {t.findings}
              </pre>
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default ReportTemplates;
