import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Printer } from 'lucide-react';
import { Button } from '../common';
import { printReportPdf } from '../../services/publicService';
import { stationeryOptions } from '../../utils/reportPrintOptions';
import '../../styles/ReportPrintActions.css';

const choices = [
  { value: 'with', label: 'With letterhead', detail: 'Includes lab header, footer and watermark' },
  { value: 'without', label: 'Without letterhead', detail: 'For preprinted letterhead paper' }
];
const menuPosition = rect => {
  const width = Math.min(280, window.innerWidth - 24);
  return { width, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
    ...(rect.bottom + 160 <= window.innerHeight ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }) };
};

export default function ReportPrintActions({ reportId, disabled = false, variant = 'secondary', size = 'sm', onStationeryChange }) {
  const id = useId();
  const trigger = useRef(null), menu = useRef(null);
  const [position, setPosition] = useState(null);
  const isOpen = position !== null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = (restoreFocus = false) => {
    setPosition(null);
    if (restoreFocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!isOpen) return;
    const outside = event => {
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) close();
    };
    const keydown = event => {
      const items = [...(menu.current?.querySelectorAll('[role="menuitem"]') || [])];
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); close(true);
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const current = items.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      } else if (event.key === 'Tab') close();
    };
    const reposition = () => {
      if (trigger.current) setPosition(menuPosition(trigger.current.getBoundingClientRect()));
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    menu.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen]);
  const open = event => {
    if (position) { close(); return; }
    setPosition(menuPosition(event.currentTarget.getBoundingClientRect()));
  };
  const print = async value => {
    close(true); setError(''); setBusy(true);
    onStationeryChange?.(value);
    try { await printReportPdf(reportId, stationeryOptions(value)); }
    catch (err) { setError(err.response?.data?.message || err.message || 'Could not print the report. Please try again.'); }
    finally { setBusy(false); }
  };
  return <span className="report-print-actions">
    <Button variant={variant} size={size} disabled={disabled || !reportId || busy}
      aria-haspopup="menu" aria-expanded={!!position} aria-controls={position ? id : undefined}
      onClick={event => { trigger.current = event.currentTarget; open(event); }}>
      <Printer size={14} /> {busy ? 'Printing…' : 'Print'} <ChevronDown size={13} />
    </Button>
    {error && <span className="report-print-error" role="alert">{error}</span>}
    {position && createPortal(<div id={id} ref={menu} role="menu" aria-label="Print report" className="report-print-menu"
      style={position} onClick={event => event.stopPropagation()}>
      <div className="report-print-menu-title">Print report</div>
      {choices.map(choice => <button type="button" key={choice.value} role="menuitem" aria-label={choice.label} onClick={() => print(choice.value)}>
        <strong>{choice.label}</strong><span>{choice.detail}</span>
      </button>)}
    </div>, document.body)}
  </span>;
}
