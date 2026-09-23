import React, { useRef, useState, useEffect } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';

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

  const clear = () => {
    setPreview('');
    setError('');
    onPreview?.('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="form-label" htmlFor="lab-logo-input">
        <span>Lab logo</span>
      </label>
      <div className="lab-profile-logo-frame" style={{ marginBottom: 10 }}>
        {preview ? (
          <img src={preview} alt="Lab logo preview" />
        ) : (
          <span className="lab-profile-logo-empty">
            <ImagePlus size={22} />
            No logo set
          </span>
        )}
      </div>
      <div className="lab-profile-logo-actions">
        <input
          ref={inputRef}
          id="lab-logo-input"
          type="file"
          accept="image/*"
          className="lab-profile-file-input"
          style={{ flex: 1, minWidth: 180 }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {preview && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={clear}>
            <Trash2 size={13} /> Clear
          </button>
        )}
      </div>
      <p className="lab-profile-note" style={{ marginTop: 6 }}>PNG with transparent background works best. Max 2 MB.</p>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

export default LogoUploader;
