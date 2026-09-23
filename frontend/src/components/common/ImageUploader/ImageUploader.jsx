import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, X, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { compressImage } from '../../../utils/compressImage';
import './ImageUploader.css';

let seq = 0;
const nextId = () => `img_${Date.now()}_${seq++}`;

/**
 * ImageUploader (Phase 5) — drag-drop multi-image upload with per-file
 * progress, error + retry, remove, and MIME/size validation.
 *
 * Uploads start immediately and NEVER block the parent form save: use
 * `uploadingCount` (via onChange) to optionally disable submit, and
 * `onUploaded(urls)` to collect finished URLs.
 *
 * Props:
 *   uploadFn(file, { onProgress }) -> url string (or { url })
 *   accept (default 'image/jpeg,image/png,image/jpg')
 *   maxSizeMB (default 8)
 *   multiple (default true)
 *   compress (default false) — downscale >1MB images client-side first
 *   initialUrls (already-stored image URLs, shown as done)
 *   onUploaded(allDoneUrls), onChange({ items, uploadingCount, doneUrls })
 *   label, disabled
 */
const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/jpg';

const ImageUploader = ({
  uploadFn,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 8,
  multiple = true,
  compress = false,
  initialUrls = [],
  onUploaded,
  onChange,
  label = 'Upload images',
  subtitle = 'Drag & drop JPG / PNG files or click to browse',
  disabled = false
}) => {
  const fileInputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [items, setItems] = useState(() =>
    (initialUrls || []).filter(Boolean).map((url) => ({
      id: nextId(),
      file: null,
      name: String(url).split('/').pop() || 'uploaded image',
      size: 0,
      preview: `/${String(url).replace(/^\//, '')}`,
      progress: 100,
      status: 'done',
      error: '',
      url
    }))
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const emit = useCallback((next) => {
    const uploadingCount = next.filter((i) => i.status === 'uploading' || i.status === 'queued').length;
    const doneUrls = next.filter((i) => i.status === 'done' && i.url).map((i) => i.url);
    if (onChange) onChange({ items: next, uploadingCount, doneUrls });
    if (onUploaded) onUploaded(doneUrls);
  }, [onChange, onUploaded]);

  const patchItem = useCallback((id, patch) => {
    const next = itemsRef.current.map((i) => (i.id === id ? { ...i, ...patch } : i));
    itemsRef.current = next;
    setItems(next);
    return next;
  }, []);

  const startUpload = useCallback(async (item) => {
    let next = patchItem(item.id, { status: 'uploading', progress: 0, error: '' });
    emit(next);
    try {
      let payload = item.file;
      if (compress) payload = await compressImage(item.file);
      const res = await uploadFn(payload, {
        onProgress: (pct) => {
          const n = patchItem(item.id, { progress: Math.max(0, Math.min(100, pct)) });
          // progress-only patch: no emit storm needed, but keep counts fresh
          void n;
        }
      });
      const url = typeof res === 'string' ? res : res?.url || res?.fileUrl || '';
      next = patchItem(item.id, { status: 'done', progress: 100, url });
      emit(next);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
      next = patchItem(item.id, { status: 'error', error: msg });
      emit(next);
    }
  }, [compress, emit, patchItem, uploadFn]);

  const validateFile = useCallback((file) => {
    const allowed = accept.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const typeOk = allowed.some((a) => {
      if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
      if (a.startsWith('.')) return (file.name || '').toLowerCase().endsWith(a);
      return file.type === a;
    });
    if (!typeOk) return `Unsupported file type: ${file.name || file.type || 'unknown'}`;
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `${file.name} exceeds ${maxSizeMB} MB`;
    }
    return '';
  }, [accept, maxSizeMB]);

  const addFiles = useCallback((fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const list = multiple ? picked : picked.slice(0, 1);
    const fresh = [];
    list.forEach((file) => {
      const err = validateFile(file);
      const item = {
        id: nextId(),
        file,
        name: file.name,
        size: file.size,
        preview: file.type.startsWith('image/') ? window.URL.createObjectURL(file) : '',
        progress: 0,
        status: err ? 'error' : 'queued',
        error: err,
        url: ''
      };
      fresh.push(item);
    });
    const next = multiple ? [...itemsRef.current, ...fresh] : fresh;
    itemsRef.current = next;
    setItems(next);
    emit(next);
    // Non-blocking: kick off valid uploads in the background.
    fresh.filter((i) => i.status === 'queued').forEach((i) => startUpload(i));
  }, [emit, multiple, startUpload, validateFile]);

  const retry = (id) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item || !item.file) return;
    startUpload(item);
  };

  const remove = (id) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (item?.preview && item.file) window.URL.revokeObjectURL(item.preview);
    // NOTE: no delete-image endpoint exists server-side — removal only
    // detaches the file from this case locally.
    const next = itemsRef.current.filter((i) => i.id !== id);
    itemsRef.current = next;
    setItems(next);
    emit(next);
  };

  useEffect(() => () => {
    itemsRef.current.forEach((i) => { if (i.file && i.preview) window.URL.revokeObjectURL(i.preview); });
  }, []);

  const uploading = items.some((i) => i.status === 'uploading' || i.status === 'queued');

  return (
    <div className="img-upl">
      <div
        className={`img-upl-dropzone ${isDragActive ? 'drag-active' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={() => { if (!disabled) fileInputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) setIsDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); if (!disabled) addFiles(e.dataTransfer.files); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); fileInputRef.current?.click(); } }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="visually-hidden"
          tabIndex={-1}
        />
        <Upload size={28} className="img-upl-icon" />
        <span className="img-upl-title">{label}</span>
        <span className="img-upl-subtitle">{subtitle}</span>
        <span className="img-upl-hint">JPG / PNG only · max {maxSizeMB} MB each{compress ? ' · large images are compressed client-side before upload' : ''}</span>
      </div>

      {items.length > 0 && (
        <div className="img-upl-grid">
          {items.map((item) => (
            <div key={item.id} className={`img-upl-card status-${item.status}`}>
              {item.preview ? (
                <img src={item.preview} alt={item.name} className="img-upl-thumb" />
              ) : (
                <div className="img-upl-thumb img-upl-thumb--empty">{(item.name || '?').slice(0, 1)}</div>
              )}
              <div className="img-upl-meta">
                <span className="img-upl-name" title={item.name}>{item.name}</span>
                {item.status === 'uploading' || item.status === 'queued' ? (
                  <div className="img-upl-progress">
                    <div className="img-upl-progress-bar" style={{ width: `${item.progress || 0}%` }} />
                  </div>
                ) : null}
                {item.status === 'uploading' ? (
                  <span className="img-upl-state img-upl-state--uploading"><Loader2 size={12} /> {Math.round(item.progress || 0)}%</span>
                ) : null}
                {item.status === 'done' ? (
                  <span className="img-upl-state img-upl-state--done"><CheckCircle2 size={12} /> Uploaded</span>
                ) : null}
                {item.status === 'error' ? (
                  <span className="img-upl-state img-upl-state--error" title={item.error}><AlertCircle size={12} /> {item.error || 'Failed'}</span>
                ) : null}
              </div>
              <div className="img-upl-actions">
                {item.status === 'error' && item.file && (
                  <button type="button" className="btn btn-secondary img-upl-btn" onClick={() => retry(item.id)} disabled={disabled}>
                    <RotateCcw size={12} /> Retry
                  </button>
                )}
                <button type="button" className="btn btn-secondary img-upl-btn" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`}>
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {uploading && <p className="img-upl-footnote">Uploading in background — you can save the case; finished images attach automatically.</p>}
    </div>
  );
};

export default ImageUploader;
