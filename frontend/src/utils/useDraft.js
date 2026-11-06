import { useEffect, useState } from 'react';

// Keeps what was typed in a form or side panel if it is closed by mistake or
// the page reloads (this browser tab only). Clear it once saved.
// Secrets are never kept: fields named like password / pin / otp / token /
// secret are always dropped, plus anything listed in `omit`.
const SECRET = /pass(word)?|^pin$|otp|token|secret|apikey|api_key/i;

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
      Object.keys(copy).forEach((field) => { if (SECRET.test(field) || omit.includes(field)) delete copy[field]; });
      const typed = Object.keys(copy).some((k) => JSON.stringify(copy[k]) !== JSON.stringify(empty[k]));
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
