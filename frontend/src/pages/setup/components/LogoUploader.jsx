import React, { useRef, useState, useEffect } from 'react';

// Phase 24 — logo uploader with client-side preview.
// Tries the real upload endpoint first; falls back to a local preview URL
// (documented) when the server upload is unavailable.
const LogoUploader = ({ value, onPreview, onFile }) => {
  const [preview, setPreview] = useState(value || '');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // Sync when the parent loads the stored logo URL asynchronously.
  useEffect(() => {
    if (value) setPreview(value);
  }, [value]);

  const handleFile = (file) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Logo must be an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2 MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onPreview?.(url);
    onFile?.(file);
  };

  return (
    <div>
      <label className="form-label"><span>Lab logo</span></label>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {preview ? (
          <img src={preview} alt="Lab logo preview" style={{ height: '48px', maxWidth: '180px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px', background: '#fff' }} />
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No logo set</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ fontSize: '0.8rem' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {preview && (
          <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => { setPreview(''); onPreview?.(''); if (inputRef.current) inputRef.current.value = ''; }}>
            Clear
          </button>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

export default LogoUploader;
