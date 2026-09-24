import React, { useState, useEffect } from 'react';
import { getUSGTemplates } from '../../services/usgService';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader, DataTable, Button } from '../../components/common';
import '../../styles/USG.css';

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

/* Read-only list of the templates served by GET /usg/templates — every name
   and findings text below comes from that response; nothing is hardcoded. */
const ReportTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  // A failed load must read as an error, never as "no templates defined".
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const res = await getUSGTemplates();
        if (res.success) {
          setTemplates(res.data);
          setLoadError(null);
        }
      } catch (err) {
        setTemplates([]);
        setLoadError(getApiErrorMessage(err, 'Failed to load USG report templates.'));
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [reloadKey]);

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
        data={templates}
        loading={loading}
        emptyMessage="No clinical templates defined."
        renderRow={(t, idx) => (
          <tr key={idx}>
            <td style={{ fontWeight: '600', verticalAlign: 'top', width: '220px' }}>{t.name}</td>
            <td>
              <pre style={{ fontFamily: 'inherit', fontSize: '0.825rem', whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)' }}>
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
