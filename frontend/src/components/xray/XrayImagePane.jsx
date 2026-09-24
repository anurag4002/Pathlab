import React from 'react';

/**
 * XrayImagePane (Phase 14) — image rendering inside the X-ray print
 * preview / report, aligned with the USG preview layout. Shows every
 * attached scan; degrades to a muted empty state when there is none.
 */
const XrayImagePane = ({ images = [], fileUrl = '' }) => {
  const list = [...(images || [])];
  if (fileUrl && !list.includes(fileUrl)) list.push(fileUrl);
  const urls = list.filter(Boolean).map((u) => (String(u).startsWith('/') || String(u).startsWith('http') ? u : `/${u}`));

  if (!urls.length) {
    return <p style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>No scan images attached to this case.</p>;
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <strong style={{ fontSize: '0.85rem' }}>ATTACHED SCANS ({urls.length}):</strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '8px' }}>
        {urls.map((src, i) => (
          <figure key={i} style={{ margin: 0, border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
            <img src={src} alt={`X-ray scan ${i + 1}`} style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#000', display: 'block' }} />
            <figcaption style={{ fontSize: '0.7rem', textAlign: 'center', padding: '2px 0', color: '#475569' }}>
              Scan {i + 1}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
};

export default XrayImagePane;
