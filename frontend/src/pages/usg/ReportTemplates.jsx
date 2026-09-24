import React, { useEffect, useState } from 'react';
import { getUSGTemplates } from '../../services/usgService';
import useClientPagination from '../../hooks/useClientPagination';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader, DataTable, Button } from '../../components/common';
import '../../styles/USG.css';

const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) return data.message;
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

const ReportTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const res = await getUSGTemplates();
        if (!active) return;
        if (!res?.success) {
          setTemplates([]);
          setLoadError(res?.message || 'Failed to load USG report templates.');
          return;
        }
        setTemplates(Array.isArray(res.data) ? res.data : []);
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setTemplates([]);
        setLoadError(getApiErrorMessage(err, 'Failed to load USG report templates.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchTemplates();
    return () => { active = false; };
  }, [reloadKey]);

  const query = search.trim().toLowerCase();
  const filtered = templates.filter((template) => {
    if (!query) return true;
    return String(template.name || '').toLowerCase().includes(query) ||
      String(template.findings || '').toLowerCase().includes(query);
  });
  const pg = useClientPagination(filtered, 10);

  return (
    <div>
      <PageHeader
        title="USG Clinical Report Templates"
        subtitle="Default findings templates available when writing USG reports"
      />

      {loadError && (
        <div className="usg-banner usg-banner-error" role="alert">
          <AlertTriangle size={16} />
          <span>{loadError}</span>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Retry
          </Button>
        </div>
      )}

      <DataTable
        headers={['Template Name', 'Default Findings Text']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No clinical templates defined."
        searchValue={search}
        onSearchChange={(event) => {
          setSearch(event.target.value);
          pg.reset();
        }}
        searchPlaceholder="Search templates…"
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit
        }}
        renderRow={(template, index) => (
          <tr key={template._id || index}>
            <td style={{ fontWeight: '600', verticalAlign: 'top', width: '220px' }}>{template.name}</td>
            <td>
              <pre style={{ fontFamily: 'inherit', fontSize: '0.825rem', whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)' }}>
                {template.findings}
              </pre>
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default ReportTemplates;
