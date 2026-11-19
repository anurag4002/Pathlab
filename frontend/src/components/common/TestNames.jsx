import React, { useState } from 'react';
import './TestNames.css';

// A report's test names, short by default ("CBC, LFT +6 more"). Tapping
// "+6 more" shows every name (works on phones, unlike a hover tooltip).
export default function TestNames({ names = [], visible = 1, className = '', empty = null }) {
  const [open, setOpen] = useState(false);
  const list = [...new Set((names || []).map((name) => String(name || '').trim()).filter(Boolean))];
  if (!list.length) return empty;
  const hidden = list.length - visible;
  const toggle = (event) => { event.stopPropagation(); event.preventDefault(); setOpen((value) => !value); };
  return (
    <span className={`test-names ${className}`.trim()} title={list.join(', ')}>
      {(open || hidden <= 0 ? list : list.slice(0, visible)).join(', ')}
      {hidden > 0 && (
        <button type="button" className="test-names-more" onClick={toggle} aria-expanded={open}>
          {open ? 'Show less' : `+${hidden} more`}
        </button>
      )}
    </span>
  );
}
