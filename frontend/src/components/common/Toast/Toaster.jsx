import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { toast } from './toast';
import './Toast.css';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

// Renders notifications bottom-centre (thumb reach on phones, out of the way
// of the sticky action bars). Hovering pauses the timer.
export default function Toaster() {
  const [items, setItems] = useState([]);
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

  return (
    <div className="toaster" aria-live="polite" aria-atomic="false">
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
