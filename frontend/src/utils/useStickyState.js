import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getUiVersion } from './uiVersion';

// Screen state that survives a reload (new look): filters, search text, the
// chosen tab or period, which side panel is open. Kept per page in this
// browser tab only (sessionStorage), so it never leaks to another computer
// and a fresh tab starts clean. In the classic look it behaves like useState.
//
//   const [tab, setTab] = useStickyState('tab', 'all');
//   const [openId, setOpenId] = useStickyState('open', null);
const keyFor = (path, name) => `ppl_view:${path}:${name}`;

function read(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export default function useStickyState(name, initial) {
  const { pathname } = useLocation();
  const enabled = getUiVersion() === 'v2';
  const key = keyFor(pathname, name);
  // Work out the starting value once (it may read storage), not every render.
  const initialRef = useRef(undefined);
  if (initialRef.current === undefined) initialRef.current = { v: typeof initial === 'function' ? initial() : initial };
  const initialValue = initialRef.current.v;
  const [value, setValue] = useState(() => (enabled ? read(key, initialValue) : initialValue));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!enabled) return;
    try {
      if (value === undefined || value === null || value === '' || JSON.stringify(value) === JSON.stringify(initialValue)) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(value));
    } catch { /* storage full or blocked: just don't remember */ }
  }, [key, value, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, setValue];
}

/** Forget everything remembered for this page (e.g. "Clear all"). */
export function useForgetScreen() {
  const { pathname } = useLocation();
  return useCallback(() => {
    try {
      Object.keys(sessionStorage).filter((k) => k.startsWith(`ppl_view:${pathname}:`)).forEach((k) => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
  }, [pathname]);
}
