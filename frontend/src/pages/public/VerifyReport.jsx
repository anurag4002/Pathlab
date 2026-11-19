import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { verifyReportToken, downloadBlob } from '../../services/publicService';
import formatDate from '../../utils/formatDate';
import { Button, PageHeader } from '../../components/common';
import { FileDown } from 'lucide-react';

const VerifyReportPage = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const res = await verifyReportToken(token);
        if (res.success) setData(res.data);
        else setError(res.message || 'Invalid verification link');
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid or expired verification link');
      } finally {
        setLoading(false);
      }
    };
    if (token) run();
  }, [token]);

  if (loading) return <p style={{ padding: '2rem' }}>Verifying report…</p>;
  if (error) return (
    <div style={{ padding: '2rem', maxWidth: '32rem', margin: '0 auto', textAlign: 'center' }}>
      <h2>Link not valid</h2>
      <p style={{ color: 'var(--color-danger)' }}>{error}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Please scan the QR on your printed report again or contact the lab.</p>
    </div>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '36rem', margin: '0 auto' }}>
      <PageHeader title="Report Verification" subtitle="This report was issued by Pure Path Lab" />
      <div style={{ display: 'grid', gap: '8px', margin: '16px 0', fontSize: '0.95rem' }}>
        <div><strong>Patient:</strong> {data.patientName}</div>
        <div><strong>Reg No:</strong> {data.registrationNumber}</div>
        <div><strong>Date:</strong> {formatDate(data.reportDate)}</div>
        <div><strong>Status:</strong> {data.status}</div>
        {!!data.resultCount && <div><strong>Results:</strong> {data.resultCount} parameters</div>}
      </div>
      {Array.isArray(data.files) && data.files.length > 1 ? (
        // An outsourced report sent as several files (one per test or group).
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.files.map((file, i) => (
            <Button
              key={file._id}
              variant={i === 0 ? 'primary' : 'secondary'}
              onClick={() => downloadBlob(`/public/r/${token}/download?file=${encodeURIComponent(file._id)}`, `Report_${data.registrationNumber}_${i + 1}${(String(file.name || '').match(/\.(pdf|png|jpe?g)$/i) || ['.pdf'])[0]}`)}
              icon={<FileDown size={16} />}
            >
              {file.tests?.length ? file.tests.join(', ') : `File ${i + 1}`}
            </Button>
          ))}
        </div>
      ) : (
        <Button variant="primary" onClick={() => downloadBlob(`/public/r/${token}/download`, `Report_${data.registrationNumber}.pdf`)} icon={<FileDown size={16} />}>
          Download PDF
        </Button>
      )}
    </div>
  );
};

export default VerifyReportPage;
