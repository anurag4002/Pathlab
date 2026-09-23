import React, { useEffect, useState } from 'react';
import { fetchBarcodeSvgUrl, getBillBarcodeUrl } from '../../services/publicService';

/**
 * BarcodeSvg (Phase 8) — renders a server-generated Code39 barcode.
 * Bill barcodes ship first:
 *   - by bill id   -> GET /api/bills/:id/barcode.svg (auth, blob URL)
 *   - by billNumber -> GET /api/public/bill/:billNumber/barcode (direct img)
 * Case/sample barcodes are NOT called (endpoints do not exist).
 */
const BarcodeSvg = ({ billId, billNumber, height = 56, label }) => {
  const [objectUrl, setObjectUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let url = '';
    if (!billId) return undefined;
    setLoading(true);
    setError('');
    fetchBarcodeSvgUrl(billId)
      .then((u) => { url = u; if (alive) setObjectUrl(u); })
      .catch(() => { if (alive) setError('Barcode unavailable'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
      if (url) window.URL.revokeObjectURL(url);
    };
  }, [billId]);

  if (!billId && !billNumber) {
    return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No barcode value</span>;
  }

  if (billId) {
    if (loading) return <span style={{ fontSize: '0.72rem' }}>Loading barcode…</span>;
    if (error || !objectUrl) return <span style={{ fontSize: '0.72rem', color: 'var(--color-danger, #dc2626)' }}>{error || 'Barcode unavailable'}</span>;
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src={objectUrl} alt={label || 'Bill barcode'} style={{ height, maxWidth: '100%' }} />
        {label && <span style={{ fontSize: '0.68rem', letterSpacing: '1px' }}>{label}</span>}
      </span>
    );
  }

  // Bill-number variant: direct <img> against the public barcode endpoint.
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <img
        src={getBillBarcodeUrl(billNumber)}
        alt={label || `Barcode ${billNumber}`}
        style={{ height, maxWidth: '100%' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <span style={{ fontSize: '0.68rem', letterSpacing: '1px' }}>{label || billNumber}</span>
    </span>
  );
};

export default BarcodeSvg;
