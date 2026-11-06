import { useEffect, useState } from 'react';

// Keeps what was typed in a side panel if it is closed by mistake (or the
// page reloads in this tab). Cleared once saved. Never pass secrets here -
// use `omit` for passwords and similar fields.
export default function useDraft(key, empty, { omit = [] } = {}) {
  const storageKey = `ppl_draft:${key}`;
  const [value, setValue] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      return saved ? { ...empty, ...saved } : empty;
    } catch { return empty; }
  });
  useEffect(() => {
    try {
      const copy = { ...value };
      omit.forEach((field) => { delete copy[field]; });
      const typed = Object.keys(copy).some((k) => copy[k] !== empty[k]);
      if (typed) sessionStorage.setItem(storageKey, JSON.stringify(copy));
      else sessionStorage.removeItem(storageKey);
    } catch { /* storage unavailable */ }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = () => {
    try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
    setValue(empty);
  };
  return [value, setValue, clear];
}
