import React, { useEffect, useRef, useState } from 'react';
import { Button, ConfirmDialog } from '../common';
import { toast } from '../common/Toast/toast';
import assetSrc from '../../utils/assetSrc';
import {
  uploadLogo, uploadLetterhead, uploadFooter, uploadSignatureStrip, updateLabProfile, getReferenceArt
} from '../../services/setupService';
import './LetterheadImages.css';

// Images printed on reports and bills. A picked or dropped image uploads
// straight away (Admin only); "Use the pad's own" clears the upload so the
// built-in letterhead pad art is printed again.
export const LETTERHEAD_IMAGES = [
  { kind: 'letterhead', zone: 'header', field: 'letterheadUrl', art: 'header', title: 'Letterhead', upload: uploadLetterhead },
  { kind: 'footer', zone: 'footer', field: 'footerUrl', art: 'footer', title: 'Footer', upload: uploadFooter },
  { kind: 'signatures', zone: 'signatures', field: 'signatureStripUrl', art: 'signatures', title: 'Signatures', upload: uploadSignatureStrip },
  { kind: 'logo', zone: 'watermark', field: 'logoUrl', art: 'watermark', title: 'Logo / watermark', upload: uploadLogo }
];
export const imageForZone = (zoneKind) => LETTERHEAD_IMAGES.find((item) => item.zone === zoneKind);

const ALLOWED = ['.jpg', '.jpeg', '.png'];
export function validateLetterheadImage(file, kind) {
  if (!file) return 'Choose an image file.';
  const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
  if (!ALLOWED.includes(extension)) return 'Use a JPG, JPEG or PNG image.';
  const maxMb = kind === 'logo' ? 2 : 10;
  if (file.size > maxMb * 1024 * 1024) return `The ${kind === 'logo' ? 'logo' : 'image'} must be ${maxMb} MB or smaller.`;
  return '';
}

const messageOf = (error, fallback) => {
  const message = error?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (error?.response?.status === 403) return 'Only an Admin can change the letterhead images.';
  if (error?.response?.status === 413) return 'The image is too large.';
  return error?.response ? fallback : 'Could not reach the server. Check the connection and try again.';
};
const profileOf = (response) => response?.data?.profile ?? response?.data;

// Upload / reset actions shared by the image list and drops on the PDF.
export function useLetterheadImageActions(onProfileChange) {
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);
  const pick = async (item, file) => {
    const problem = validateLetterheadImage(file, item.kind);
    if (problem) { toast.error(problem); return; }
    setBusy(item.kind);
    try {
      const response = await item.upload(file);
      if (!response?.success) throw new Error(response?.message);
      const next = profileOf(response);
      if (next && typeof next === 'object') onProfileChange(next, item);
      toast.success(`${item.title} image uploaded.`);
    } catch (error) {
      toast.error(messageOf(error, `The ${item.title.toLowerCase()} image could not be uploaded.`));
    } finally { setBusy(''); }
  };
  const reset = async () => {
    const item = confirm;
    setBusy(item.kind);
    try {
      const response = await updateLabProfile({ [item.field]: '' });
      if (!response?.success) throw new Error(response?.message);
      onProfileChange(profileOf(response), item);
      toast.success(`${item.title}: the letterhead pad's own image is used again.`);
      setConfirm(null);
    } catch (error) {
      toast.error(messageOf(error, `The ${item.title.toLowerCase()} image could not be removed.`));
    } finally { setBusy(''); }
  };
  const dialog = (
    <ConfirmDialog
      isOpen={Boolean(confirm)}
      onClose={() => { if (!busy) setConfirm(null); }}
      onConfirm={reset}
      loading={Boolean(busy)}
      title={confirm ? `Remove the uploaded ${confirm.title.toLowerCase()} image?` : ''}
      message="Reports and bills will print the letterhead pad's own image again. You can upload a new one at any time."
      confirmText="Use the pad's own"
    />
  );
  return { busy, pick, askReset: setConfirm, dialog };
}

// The pad's own art, fetched once per page load (needs the Admin's token).
const padArt = {};
function usePadArt(name) {
  const [url, setUrl] = useState(padArt[name]?.url || '');
  useEffect(() => {
    let alive = true;
    if (!padArt[name]) {
      padArt[name] = { promise: getReferenceArt(name).then((blob) => { padArt[name].url = URL.createObjectURL(blob); return padArt[name].url; }) };
      padArt[name].promise.catch(() => { delete padArt[name]; });
    }
    padArt[name].promise.then((u) => { if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [name]);
  return url;
}

// One image: thumbnail, Replace / Use the pad's own, accepts a dropped file.
export function LetterheadImageRow({ item, url, actions, disabled }) {
  const input = useRef(null);
  const [broken, setBroken] = useState('');
  const [dragging, setDragging] = useState(false);
  const pad = usePadArt(item.art);
  const src = assetSrc(url);
  const missing = Boolean(src) && broken === src;
  const shown = src && !missing ? src : !src ? pad : '';
  const off = disabled || Boolean(actions.busy);
  const uploading = actions.busy === item.kind;

  const dropProps = off ? {} : {
    onDragEnter: (e) => { e.preventDefault(); setDragging(true); },
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!dragging) setDragging(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); },
    onDrop: (e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files?.[0]; if (file) actions.pick(item, file); }
  };

  return (
    <div className={`lh-row${dragging ? ' is-dragging' : ''}`} data-image={item.kind} {...dropProps}>
      <div className={`lh-row-thumb lh-row-thumb-${item.kind}`}>
        {missing ? <span className="lh-row-missing">File missing</span>
          : shown ? <img src={shown} alt="" onError={() => { if (src) setBroken(src); }} />
            : <span>…</span>}
        {(dragging || uploading) && <div className="lh-row-drop">{uploading ? 'Uploading…' : 'Drop to replace'}</div>}
      </div>
      <div className="lh-row-text">
        <span className="lh-row-title">{item.title}</span>
        <span className={`lh-row-badge${src && !missing ? ' is-uploaded' : ''}`}>
          {missing ? "The uploaded file is missing. Upload it again or use the pad's own." : src ? 'Uploaded' : "Letterhead pad's own"}
        </span>
      </div>
      <div className="lh-row-actions">
        <input ref={input} type="file" accept=".jpg,.jpeg,.png" hidden aria-label={`Replace the ${item.title.toLowerCase()} image`}
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) actions.pick(item, file); }} />
        <Button type="button" size="sm" variant="secondary" loading={uploading} disabled={off}
          onClick={() => input.current?.click()}>{src && !missing ? 'Replace' : 'Upload'}</Button>
        {src && <Button type="button" size="sm" variant="ghost" disabled={off} onClick={() => actions.askReset(item)}>Use pad's own</Button>}
      </div>
    </div>
  );
}

export default function LetterheadImages({ profile, actions, only, disabled }) {
  const items = only ? LETTERHEAD_IMAGES.filter((item) => only.includes(item.kind)) : LETTERHEAD_IMAGES;
  return (
    <div className="lh-list">
      {items.map((item) => <LetterheadImageRow key={item.kind} item={item} url={profile?.[item.field]} actions={actions} disabled={disabled} />)}
    </div>
  );
}
