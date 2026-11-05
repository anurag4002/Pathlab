import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import './RowMenu.css';

const MENU_WIDTH = 176;
// Place the menu under the trigger (or above it near the bottom of the
// screen), kept inside the viewport.
const placeMenu = (rect, itemCount) => {
  const height = itemCount * 38 + 10;
  const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
  const below = rect.bottom + 4 + height <= window.innerHeight;
  return below ? { left, top: rect.bottom + 4 } : { left, top: Math.max(8, rect.top - 4 - height) };
};

/**
 * Compact "More" menu for secondary row actions (edit, refund, void...),
 * so tables keep one short row per record. The list is rendered on top of
 * the page (portal) so table rows and frozen columns can never cover it.
 * items: [{ label, onClick, danger?, testId?, ariaLabel? }]
 */
export default function RowMenu({ items = [], label = 'More actions' }) {
  const [position, setPosition] = useState(null);
  const trigger = useRef(null), menu = useRef(null);
  const id = useId();
  const visible = items.filter(Boolean);
  const open = position !== null;
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setPosition(null); };
    const key = (event) => { if (event.key === 'Escape') { setPosition(null); trigger.current?.focus(); } };
    // Follow the button while the page scrolls; close once it leaves the screen.
    const dismiss = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) setPosition(null);
      else setPosition(placeMenu(rect, visible.length));
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    menu.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open, visible.length]);
  if (!visible.length) return null;
  return (
    <span className="row-menu">
      <button ref={trigger} type="button" className="btn btn-secondary btn-sm row-menu-trigger" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? id : undefined} aria-label={label} title={label}
        onClick={() => setPosition(open ? null : placeMenu(trigger.current.getBoundingClientRect(), visible.length))}>
        <MoreHorizontal size={14} />
      </button>
      {open && createPortal(
        <div ref={menu} className="row-menu-list" role="menu" id={id} style={{ left: position.left, top: position.top, width: MENU_WIDTH }}>
          {visible.map((item) => (
            <button key={item.label} type="button" role="menuitem" className={item.danger ? 'is-danger' : ''}
              data-testid={item.testId} aria-label={item.ariaLabel || item.label}
              onClick={() => { setPosition(null); item.onClick(); }}>
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </span>
  );
}
