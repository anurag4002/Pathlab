import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { verifyBillToken, downloadBlob } from '../../services/publicService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import { Button, PageHeader, StatusBadge } from '../../components/common';
import { FileDown } from 'lucide-react';

const VerifyBillPage = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const res = await verifyBillToken(token);
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

  if (loading) return <p style={{ padding: '2rem' }}>Verifying bill…</p>;
  if (error) return (
    <div style={{ padding: '2rem', maxWidth: '32rem', margin: '0 auto', textAlign: 'center' }}>
      <h2>Link not valid</h2>
      <p style={{ color: 'var(--color-danger)' }}>{error}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Please scan the QR on your printed bill again or contact the lab.</p>
    </div>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '36rem', margin: '0 auto' }}>
      <PageHeader title="Bill Verification" subtitle="This invoice was issued by Pure Path Lab" />
      <div style={{ display: 'grid', gap: '8px', margin: '16px 0', fontSize: '0.95rem' }}>
        <div><strong>Bill No:</strong> {data.billNumber}</div>
        <div><strong>Patient:</strong> {data.patientName}</div>
        <div><strong>Date:</strong> {formatDate(data.date)}</div>
        <div><strong>Total:</strong> {formatCurrency(data.totalAmount)}</div>
        <div><strong>Paid:</strong> {formatCurrency(data.paidAmount)}</div>
        <div><strong>Due:</strong> {formatCurrency(data.dueAmount)}</div>
        <div><strong>Status:</strong> <StatusBadge status={data.voided ? 'Voided' : data.paymentStatus} /></div>
      </div>
      <Button variant="primary" onClick={() => downloadBlob(`/public/r/bill/${token}/download`, `Bill_${data.billNumber}.pdf`)} icon={<FileDown size={16} />}>
        Download PDF
      </Button>
    </div>
  );
};

export default VerifyBillPage;
