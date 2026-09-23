import React from 'react';
import LabelTemplate from './LabelTemplate';

/**
 * StickerPreview (Phase 8) — grid preview of N identical patient labels
 * before printing. Case-wise / sample-wise stickers are NOT rendered:
 * their barcode endpoints do not exist (see LabelPrintSheet gate note).
 */
const StickerPreview = ({ copies = 1, labelProps }) => {
  const n = Math.max(1, Math.min(12, Number(copies) || 1));
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
      {Array.from({ length: n }).map((_, i) => (
        <LabelTemplate key={i} {...labelProps} />
      ))}
    </div>
  );
};

export default StickerPreview;
