import React, { useState, useEffect } from 'react';
import { getXrayCases } from '../../services/xrayService';
import { getLabProfile, getSignatures } from '../../services/setupService';
import formatDate from '../../utils/formatDate';
import downloadFile from '../../utils/downloadFile';
import useClientPagination from '../../hooks/useClientPagination';
import { Download, Printer } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal } from '../../components/common';
import XrayImagePane from '../../components/xray/XrayImagePane';

const XrayReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [labProfile, setLabProfile] = useState(null);
  const [signatures, setSignatures] = useState([]);

  // Print preview (aligned with USG preview + XrayImagePane)
  const [printTarget, setPrintTarget] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);

  // Search + client-side pagination (backend returns the full list).
  const [search, setSearch] = useState('');
  const filteredReports = reports.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(c.patient?.name || '').toLowerCase().includes(q) ||
      String(c.patient?.registrationNumber || '').toLowerCase().includes(q);
  });
  const pg = useClientPagination(filteredReports, 10);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await getXrayCases({ status: 'Completed' });
        if (res.success) {
          // filter cases that actually have files uploaded
          setReports(res.data.filter(c => c.fileUrl));
        }
      } catch (err) {
        console.error('Failed to load X-ray reports', err);
      } finally {
        setLoading(false);
      }
    };
    const loadBranding = async () => {
      try {
        const [profRes, sigRes] = await Promise.all([
          getLabProfile().catch(() => null),
          getSignatures().catch(() => null)
        ]);
        if (profRes?.success) setLabProfile(profRes.data?.profile || profRes.data);
        if (sigRes?.success) setSignatures(Array.isArray(sigRes.data) ? sigRes.data : sigRes.data?.signatures || []);
      } catch (err) {
        console.error('Failed to load branding', err);
      }
    };
    fetchReports();
    loadBranding();
  }, []);

  const labName = labProfile?.labName || 'PURE PATH LAB';
  const labTagline = labProfile?.tagline || 'Pathology & Diagnostic Center';
  const labContact = [labProfile?.address, labProfile?.phone, labProfile?.email].filter(Boolean).join(' · ');
  const logoSrc = labProfile?.logoUrl ? `/${String(labProfile.logoUrl).replace(/^\//, '')}` : '/logo.jpg';
  const xraySignature = signatures.find((s) => (s.modalities || s.assignedDepartments || []).includes('XRAY')) || signatures[0];
  const signatoryName = xraySignature?.name || printTarget?.signedBy?.name || 'Authorised Signatory';
  const signatoryTitle = xraySignature?.title || 'Consultant Radiologist';

  return (
    <div>
      <PageHeader
        title="Completed X-Ray Reports Archive"
        subtitle="Access and download scanned digital radiographs and signed clinical reports"
      />

      <DataTable
        headers={['Completed Date', 'Registration No', 'Patient Name', 'Referring Doctor', 'Download Scan File', 'Preview']}
        data={pg.paged}
        loading={loading}
        emptyMessage="No completed X-Ray scans archived yet."
        searchValue={search}
        onSearchChange={(e) => { setSearch(e.target.value); pg.reset(); }}
        searchPlaceholder="Search patient…"
        pagination={{
          total: pg.total,
          page: pg.page,
          limit: pg.limit,
          pages: pg.pages,
          onPageChange: pg.goToPage,
          onLimitChange: pg.setLimit,
        }}
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
                onClick={() => downloadFile(`/${c.fileUrl}`, `xray_scan_${c.patient?.registrationNumber}.jpg`)}
              >
                <Download size={14} /> Download Scan
              </button>
            </td>
            <td>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => { setPrintTarget(c); setPrintOpen(true); }}
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

            <XrayImagePane images={printTarget.images || printTarget.imageUrls || []} fileUrl={printTarget.fileUrl} />

            <div style={{ borderTop: '1px solid #000', marginTop: '2rem', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'center', width: '200px' }}>
                {(xraySignature?.imageUrl || printTarget.signatureUrl) && (
                  <img
                    src={xraySignature?.imageUrl ? `/${String(xraySignature.imageUrl).replace(/^\//, '')}` : `/${printTarget.signatureUrl}`}
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
