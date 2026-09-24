import React, { useState } from 'react';
import assetSrc from '../../../utils/assetSrc';
import './SignaturePreview.css';

const isImageUrl = (url) => /\.(?:jpg|jpeg|png|gif|webp)(?:$|\?)/i.test(url);

const SignaturePreview = ({ url, label = 'Signature', className = '' }) => {
  const src = assetSrc(url);
  const [brokenUrl, setBrokenUrl] = useState('');

  if (!src) {
    return <div className={`signature-preview-empty ${className}`.trim()}>No signature file</div>;
  }

  if (brokenUrl === src) {
    return (
      <div className={`signature-preview-empty ${className}`.trim()}>
        <span>Signature unavailable</span>
        <a href={src} target="_blank" rel="noreferrer" aria-label={`Open ${label} file`}>Open file</a>
      </div>
    );
  }

  if (isImageUrl(src)) {
    return (
      <img
        className={`signature-preview-image ${className}`.trim()}
        src={src}
        alt={label}
        loading="lazy"
        decoding="async"
        onError={() => setBrokenUrl(src)}
      />
    );
  }

  return (
    <div className={`signature-preview-empty ${className}`.trim()}>
      <span>Signature file</span>
      <a href={src} target="_blank" rel="noreferrer" aria-label={`Open ${label} file`}>Open file</a>
    </div>
  );
};

export default SignaturePreview;
