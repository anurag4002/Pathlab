import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { toast } from './toast';
import './Toast.css';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

// Button bars at the bottom of the screen (Save / Pay bars, panel and dialog
// footers). Toasts sit above them so they never cover the buttons. Pages can
// opt in with data-toast-avoid.
// Main buttons near the bottom (e.g. Create Invoice in Classic) count too.
const BOTTOM_BARS = '[data-toast-avoid], .lp-v2-actions, .bill-pay, .pps-actionbar, .modal-footer, .re-actions-bar, .btn-primary';

// Space to keep free at the bottom of the viewport, in px: the top of any
// visible bar that reaches into the bottom-right corner where toasts appear.
function bottomBarSpace() {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const toastLeft = vw <= 640 ? 0 : vw - Math.min(26 * 16, vw - 32) - 40;
  let space = 0;
  document.querySelectorAll(BOTTOM_BARS).forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (!rect.height || !rect.width || rect.top >= vh || rect.bottom < vh - 160) return;
    if (rect.right <= toastLeft) return;
    space = Math.max(space, vh - rect.top + 8);
  });
  return Math.min(space, vh / 2);
}

// Renders notifications bottom-right (full width on phones), lifted above any
// pinned action bar. Hovering pauses the timer.
export default function Toaster() {
  const [items, setItems] = useState([]);
  const [lift, setLift] = useState(0);
  const timers = useRef(new Map());

  const dismiss = (id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 180);
  };
  const schedule = (item) => {
    clearTimeout(timers.current.get(item.id));
    timers.current.set(item.id, setTimeout(() => dismiss(item.id), item.duration));
  };

  useEffect(() => toast.subscribe((item) => {
    // The same message twice in a row just restarts its timer.
    setItems((prev) => {
      const same = prev.find((existing) => existing.text === item.text && existing.type === item.type && !existing.leaving);
      if (same) { schedule(same); return prev; }
      schedule(item);
      return [...prev.slice(-3), item];
    });
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Track pinned bars only while something is showing.
  const showing = items.length > 0;
  useEffect(() => {
    if (!showing) return undefined;
    let frame = 0;
    const measure = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setLift(bottomBarSpace())); };
    measure();
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
    };
  }, [showing]);

  return (
    <div className="toaster" aria-live="polite" aria-atomic="false" style={lift ? { '--toast-lift': `${Math.round(lift)}px` } : undefined}>
      {items.map((item) => {
        const Icon = ICONS[item.type] || Info;
        return (
          <div key={item.id} className={`toast toast-${item.type}${item.leaving ? ' toast-leaving' : ''}`}
            role={item.type === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => clearTimeout(timers.current.get(item.id))}
            onMouseLeave={() => schedule(item)}>
            <Icon size={18} aria-hidden="true" className="toast-icon" />
            <span className="toast-text">{item.text}</span>
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(item.id)}><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
