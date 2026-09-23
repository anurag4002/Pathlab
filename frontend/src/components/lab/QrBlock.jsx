import React from 'react';
import { QrCode } from 'lucide-react';

// Phase 10 — QrBlock. Renders qrDataUrl when present; falls back to plain
// verification URL text so the report stays verifiable if the image fails.
const QrBlock = ({ qrDataUrl, verifyUrl, size = 100 }) => {
  if (!qrDataUrl && !verifyUrl) return null;
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="Scan to verify report"
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: 'contain', border: '1px solid #e5e7eb' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <span
          style={{
            width: size, height: size, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', border: '1px dashed #9ca3af', color: '#6b7280',
          }}
          title="QR image unavailable"
        >
          <QrCode size={28} />
        </span>
      )}
      <div style={{ fontSize: '0.75rem', color: '#4b5563', wordBreak: 'break-all' }}>
        <div style={{ fontWeight: 600, color: '#111827' }}>Scan to verify report</div>
        {verifyUrl && <div>{verifyUrl}</div>}
        {!qrDataUrl && verifyUrl && (
          <div style={{ color: '#6b7280' }}>(QR image unavailable — use the URL above)</div>
        )}
      </div>
    </div>
  );
};

export default QrBlock;
