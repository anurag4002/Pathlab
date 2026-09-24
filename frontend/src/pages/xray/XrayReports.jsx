import React, { useEffect, useState } from 'react';
import { getXrayCases } from '../../services/xrayService';
import { getLabProfile, getSignatures } from '../../services/setupService';
import formatDate from '../../utils/formatDate';
import downloadFile from '../../utils/downloadFile';
import useClientPagination from '../../hooks/useClientPagination';
import { AlertTriangle, Download, Printer, RefreshCw } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal } from '../../components/common';
import XrayImagePane from '../../components/xray/XrayImagePane';
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
        const res = await getXrayCases({ status: 'Completed' });
        if (!active) return;
        if (!res?.success) {
          setReports([]);
          setLoadError(res?.message || 'Failed to load X-Ray reports.');
          return;
        }
        const rows = Array.isArray(res.data) ? res.data : [];
        setReports(rows.filter((report) => report.fileUrl));
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
        headers={['Completed Date', 'Registration No', 'Patient Name', 'Referring Doctor', 'Download Scan File', 'Preview']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No completed X-Ray scans archived yet."
        searchValue={search}
        onSearchChange={(event) => {
          setSearch(event.target.value);
          pg.reset();
        }}
        searchPlaceholder="Search patient…"
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
            <td>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => downloadFile(
                  `/${report.fileUrl}`,
                  `xray_scan_${report.patient?.registrationNumber}${scanFileExt(report.fileUrl)}`
                )}
              >
                <Download size={14} /> Download Scan
              </button>
            </td>
            <td>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => {
                  setPrintTarget(report);
                  setPrintOpen(true);
                }}
              >
                <Printer size={14} /> Preview
              </button>
            </td>
          </tr>
        )}
      />

      <Modal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title="X-Ray Report Print Preview"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPrintOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Print Report</Button>
          </>
        }
      >
        {printTarget && (
          <div className="printable-area" style={{ padding: '16px', color: '#000', fontSize: '0.9rem', lineHeight: '1.5' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src={logoSrc} alt="Logo" style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '4px', objectFit: 'cover' }} />
              <h2 style={{ margin: 0, fontWeight: '700' }}>{labName}</h2>
              <p style={{ margin: '2px 0' }}>{labTagline}</p>
              {labContact && <p style={{ margin: '2px 0', fontSize: '0.75rem' }}>{labContact}</p>}
              <p style={{ margin: '2px 0', fontWeight: '600' }}>DIGITAL X-RAY REPORT</p>
              <div style={{ borderBottom: '2px solid #000', margin: '10px 0', width: '100%' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
              <div>
                <strong>Patient Name:</strong> {printTarget.patient?.name}<br />
                <strong>Age / Gender:</strong> {printTarget.patient?.age} Yrs / {printTarget.patient?.gender}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Reg Code:</strong> {printTarget.patient?.registrationNumber}<br />
                <strong>Date:</strong> {formatDate(printTarget.date).split(',')[0]}
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #000', marginBottom: '1rem' }}></div>
            <div style={{ minHeight: '200px', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
              <strong>FINDINGS:</strong><br /><br />
              {printTarget.findings}
            </div>
            <XrayImagePane
              images={printTarget.images || printTarget.imageUrls || []}
              fileUrl={printTarget.fileUrl}
            />

            <div style={{ borderTop: '1px solid #000', marginTop: '2rem', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'center', width: '200px' }}>
                {(xraySignature?.imageUrl || printTarget.signatureUrl) && (
                  <img
                    src={xraySignature?.imageUrl
                      ? `/${String(xraySignature.imageUrl).replace(/^\//, '')}`
                      : `/${printTarget.signatureUrl}`}
                    alt="Signature"
                    style={{ height: '40px', objectFit: 'contain' }}
                  />
                )}
                <div style={{ height: (xraySignature?.imageUrl || printTarget.signatureUrl) ? '4px' : '40px' }}></div>
                <strong>{signatoryName}</strong><br />
                <span>{signatoryTitle}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default XrayReports;
