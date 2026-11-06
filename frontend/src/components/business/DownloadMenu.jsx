import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import Button from '../common/Button/Button';

// One "Download" button with a short list of files, instead of a row of
// "Export ... (CSV)" buttons. items: [{ label, onClick }]
export default function DownloadMenu({ items = [], label = 'Download' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const esc = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  const run = async (item) => {
    setOpen(false); setBusy(true);
    try { await item.onClick(); } finally { setBusy(false); }
  };
  return (
    <div className="biz-download" ref={ref}>
      <Button variant="secondary" size="sm" icon={<Download size={14} />} loading={busy} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label} <ChevronDown size={14} aria-hidden="true" />
      </Button>
      {open && (
        <div className="biz-download-menu" role="menu">
          {shown.map((item) => (
            <button key={item.label} type="button" role="menuitem" onClick={() => run(item)}>{item.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
