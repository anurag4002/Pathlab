import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { notify } from '../Toast/toast';
import './CopyButton.css';

// Small copy-to-clipboard icon shown on hover next to a bill number, phone
// or registration number, so staff never retype them into WhatsApp / calls.
export default function CopyButton({ value, label = 'value' }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      notify(`Copied ${label} ${value}`);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      notify(`Could not copy the ${label}.`);
    }
  };
  return (
    <button type="button" className={`copy-btn${copied ? ' is-copied' : ''}`} onClick={copy}
      aria-label={`Copy ${label} ${value}`} title={`Copy ${label}`}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}
