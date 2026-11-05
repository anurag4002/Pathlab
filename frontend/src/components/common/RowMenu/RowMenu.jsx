import React, { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import './RowMenu.css';

/**
 * Compact "More" menu for secondary row actions (edit, refund, void...),
 * so tables keep one short row per record.
 * items: [{ label, onClick, danger?, testId?, ariaLabel? }]
 */
export default function RowMenu({ items = [], label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();
  const visible = items.filter(Boolean);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const key = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    ref.current?.querySelector('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [open]);
  if (!visible.length) return null;
  return (
    <span className="row-menu" ref={ref}>
      <button type="button" className="btn btn-secondary btn-sm row-menu-trigger" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? id : undefined} aria-label={label} title={label} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <span className="row-menu-list" role="menu" id={id}>
          {visible.map((item) => (
            <button key={item.label} type="button" role="menuitem" className={item.danger ? 'is-danger' : ''}
              data-testid={item.testId} aria-label={item.ariaLabel || item.label}
              onClick={() => { setOpen(false); item.onClick(); }}>
              {item.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
