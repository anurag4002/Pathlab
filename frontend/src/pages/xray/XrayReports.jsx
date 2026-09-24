import React, { useState, useEffect } from 'react';
import { getXrayCases } from '../../services/xrayService';
import formatDate from '../../utils/formatDate';
import downloadFile from '../../utils/downloadFile';
import { AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { DataTable, PageHeader, Button } from '../../components/common';
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

// The scan's extension comes from the API-provided fileUrl, so downloads
// keep the uploaded file's real type (jpg/png/pdf) instead of a fixed name.
const scanFileExt = (fileUrl) => (fileUrl?.includes('.') ? `.${fileUrl.split('.').pop()}` : '');

const XrayReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  // A failed load must read as an error, never as an empty archive.
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await getXrayCases({ status: 'Completed' });
        if (res.success) {
          // filter cases that actually have files uploaded
          setReports(res.data.filter(c => c.fileUrl));
          setLoadError(null);
        }
      } catch (err) {
        setReports([]);
        setLoadError(getApiErrorMessage(err, 'Failed to load X-Ray reports.'));
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [reloadKey]);

  return (
    <div>
      <PageHeader
        title="Completed X-Ray Reports Archive"
        subtitle="Access and download completed digital radiographs and clinical reports"
      />

      {loadError && (
        <div className="xray-banner xray-banner-error" role="alert">
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
        headers={['Completed Date', 'Registration No', 'Patient Name', 'Referring Doctor', 'Download Scan File']}
        data={reports}
        loading={loading}
        emptyMessage="No completed X-Ray scans archived yet."
        renderRow={(c) => (
          <tr key={c._id}>
            <td>{formatDate(c.date).split(',')[0]}</td>
            <td style={{ fontWeight: '600' }}>{c.patient?.registrationNumber}</td>
            <td style={{ fontWeight: '600' }}>{c.patient?.name}</td>
            <td>{c.referringDoctor?.name || 'Self'}</td>
            <td>
              <button
                className="btn btn-primary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => downloadFile(`/${c.fileUrl}`, `xray_scan_${c.patient?.registrationNumber}${scanFileExt(c.fileUrl)}`)}
              >
                <Download size={14} /> Download Scan
              </button>
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export default XrayReports;
