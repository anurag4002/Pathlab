import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Lightbulb, X } from 'lucide-react';
import { useUiVersion } from '../../utils/uiVersion';

// One short tip per busy screen (new look), closable for good. Keys shown as
// pills so the shortcut is learned where it is used.
const K = ({ children }) => <kbd className="page-tip-kbd">{children}</kbd>;
const TIPS = {
  '/dashboard': <>Press <K>Ctrl</K>+<K>B</K> on any screen to start a new bill. Press <K>?</K> to see every shortcut.</>,
  '/cases/bills/new': <>Type a test, press <K>Enter</K> to add it. Type the amount received, press <K>Enter</K> to create the bill.</>,
  '/cases/bills': <>Each row shows the next step - <b>Pay</b> or <b>Results</b>. Print, PDF and more are under <b>⋯</b>. Press <K>/</K> to search.</>,
  '/lab/reports': <>The blue button on a row is the next step for that report. Press <K>/</K> to search.</>,
  '/lab/result-entry': <>Open a case, type a value and press <K>Enter</K> to move to the next one. <K>Ctrl</K>+<K>S</K> saves, <K>Ctrl</K>+<K>Enter</K> marks it Final.</>,
  '/lab/verification': <>Click a row to review it, then sign it off.</>,
  '/cases/patients': <><b>New bill</b> on a row starts a bill with that patient already filled in.</>,
  '/business/dues': <><b>Collect</b> takes a payment for that bill. The total due at the top matches the dashboard.</>,
};

export default function PageTip({ path, inline = false }) {
  const location = useLocation();
  const route = path || location.pathname;
  const isV2 = useUiVersion() === 'v2';
  const key = `ppl_tip_hidden:${route}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const tip = TIPS[route];
  if (!isV2 || !tip || hidden) return null;
  const hide = () => { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } setHidden(true); };
  return (
    <div className={`page-tip${inline ? ' page-tip--inline' : ''}`} role="note">
      <Lightbulb size={15} aria-hidden="true" />
      <span><b>Tip:</b> {tip}</span>
      <button type="button" aria-label="Hide this tip" onClick={hide}><X size={14} /></button>
    </div>
  );
}
