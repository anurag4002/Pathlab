import ServerPdfPreview from '../../components/lab/ServerPdfPreview';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getXrayCases } from '../../services/xrayService';
import { getLabProfile, getSignatures } from '../../services/setupService';
import { printPdfPath, downloadBlob } from '../../services/publicService';
import formatDate from '../../utils/formatDate';
import downloadFile from '../../utils/downloadFile';
import useClientPagination from '../../hooks/useClientPagination';
import { AlertTriangle, Download, Printer, RefreshCw } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, AdvancedFilterBar } from '../../components/common';
import XrayImagePane from '../../components/xray/XrayImagePane';
import XrayReportUpload from '../../components/xray/XrayReportUpload';
import '../../styles/Xray.css';

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

const scanFileExt = (fileUrl) => (fileUrl?.includes('.') ? `.${fileUrl.split('.').pop()}` : '');

const XrayReports = () => {
  // Print pop-up stays React state but is mirrored to ?print=<id>.
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [labProfile, setLabProfile] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [printTarget, setPrintTarget] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [search, setSearch] = useState('');

  const query = search.trim().toLowerCase();
  const filteredReports = reports.filter((report) => {
    if (!query) return true;
    return String(report.patient?.name || '').toLowerCase().includes(query) ||
      String(report.patient?.registrationNumber || '').toLowerCase().includes(query);
  });
  const pg = useClientPagination(filteredReports, 10);

  useEffect(() => {
    let active = true;
    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await getXrayCases();
        if (!active) return;
        if (!res?.success) {
          setReports([]);
          setLoadError(res?.message || 'Failed to load X-Ray reports.');
          return;
        }
        const rows = Array.isArray(res.data) ? res.data : [];
        setReports(rows);
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setReports([]);
        setLoadError(getApiErrorMessage(err, 'Failed to load X-Ray reports.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchReports();
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    const loadBranding = async () => {
      const [profileRes, signatureRes] = await Promise.all([
        getLabProfile().catch(() => null),
        getSignatures().catch(() => null)
      ]);
      if (!active) return;
      if (profileRes?.success) {
        setLabProfile(profileRes.data?.profile || profileRes.data || null);
      }
      if (signatureRes?.success) {
        setSignatures(
          Array.isArray(signatureRes.data)
            ? signatureRes.data
            : signatureRes.data?.signatures || []
        );
      }
    };
    loadBranding();
    return () => { active = false; };
  }, []);

  // Reopen the print pop-up from a shared/reloaded URL once reports load.
  useEffect(() => {
    const printId = searchParams.get('print');
    if (printId && !printOpen && reports.length) {
      const found = reports.find((r) => String(r._id) === String(printId));
      if (found) { setPrintTarget(found); setPrintOpen(true); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  const labName = labProfile?.labName || 'PURE PATH LAB';
  const labTagline = labProfile?.tagline || 'Pathology & Diagnostic Center';
  const labContact = [labProfile?.address, labProfile?.phone, labProfile?.email].filter(Boolean).join(' · ');
  const logoSrc = labProfile?.logoUrl
    ? `/${String(labProfile.logoUrl).replace(/^\//, '')}`
    : '/logo.jpg';
  const xraySignature = signatures.find((signature) =>
    (signature.modalities || signature.assignedDepartments || []).includes('XRAY')
  ) || signatures[0];
  const signatoryName = xraySignature?.name || printTarget?.signedBy?.name || 'Authorised Signatory';
  const signatoryTitle = xraySignature?.title || 'Consultant Radiologist';

  return (
    <div>
      <PageHeader
        title="Completed X-Ray Reports Archive"
        subtitle="Track billed X-Ray orders, enter findings and view completed reports"
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

      <AdvancedFilterBar
        showSearchButton={false}
        showClearButton={!!search}
        onClear={() => { setSearch(''); pg.reset(); }}
        values={{ search }}
        onChange={(key, value) => {
          if (key === 'search') { setSearch(value); pg.reset(); }
        }}
        fields={[
          { key: 'search', label: 'Search', type: 'text', size: 'lg', placeholder: 'Search patient…' }
        ]}
      />

      <DataTable
        headers={['Date', 'Registration No', 'Patient Name', 'Referring Doctor', 'Status', 'Scan File', 'Report']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No X-Ray orders or reports found."
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit
        }}
        renderRow={(report) => (
          <tr key={report._id}>
            <td>{formatDate(report.date).split(',')[0]}</td>
            <td style={{ fontWeight: '600' }}>{report.patient?.registrationNumber}</td>
            <td style={{ fontWeight: '600' }}>{report.patient?.name}</td>
            <td>{report.referringDoctor?.name || 'Self'}</td>
            <td>{report.status || 'Pending'}</td>
            <td>
              {!!report.reportFile?.size && <Button variant="secondary" size="sm" onClick={() => downloadBlob(`/xray/${report._id}/file`, report.reportFile.name || 'X-Ray-report.pdf').catch(error => alert(error.message))}>Download PDF</Button>}
              {report.fileUrl ? <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => downloadFile(
                  `/${report.fileUrl}`,
                  `xray_scan_${report.patient?.registrationNumber}${scanFileExt(report.fileUrl)}`
                )}
              >
                <Download size={14} /> Download Scan
              </button> : !report.reportFile?.size && <span>Not uploaded</span>}
            </td>
            <td>
              <XrayReportUpload record={report} onUploaded={() => setReloadKey(key => key + 1)} />
              <Link className="btn btn-secondary" to={`/xray/today?case=${report._id}`}>Enter / edit report</Link>
              {report.status === 'Completed' && (report.findings?.trim() || report.fileUrl || report.reportFile?.size) && <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => {
                  setPrintTarget(report);
                  setPrintOpen(true);
                  if (report?._id) setSearchParams({ print: report._id }, { replace: true });
                }}
              >
                <Printer size={14} /> Preview
              </button>}
            </td>
          </tr>
        )}
      />

      <Modal
        isOpen={printOpen}
        onClose={() => { setPrintOpen(false); setSearchParams({}, { replace: true }); }}
        title="X-Ray Report Print Preview"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setPrintOpen(false); setSearchParams({}, { replace: true }); }}>Close</Button>
            <Button variant="primary" onClick={() => printTarget?._id && printPdfPath(`/xray/${printTarget._id}/pdf`).catch(() => alert('Could not print the report. Please try again.'))}><Printer size={16} /> Print Report</Button>
          </>
        }
      >
        {printTarget?._id && <ServerPdfPreview path={`/xray/${printTarget._id}/pdf`} />}
      </Modal>
    </div>
  );
};

export default XrayReports;
