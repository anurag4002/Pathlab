import { useSyncExternalStore } from 'react';

// Classic vs New UI. Saved per signed-in user on this browser (shared lab
// computers keep each person's choice). The New UI adds the `ui-v2` class on
// <html>; every new style is scoped under it, so Classic looks exactly as
// before. Screens that change layout read useUiVersion().
const listeners = new Set();
const keyFor = () => {
  try { return `ppl_ui_version:${JSON.parse(localStorage.getItem('ppl_user') || '{}')?._id || 'guest'}`; } catch { return 'ppl_ui_version:guest'; }
};

export function getUiVersion() {
  try { return localStorage.getItem(keyFor()) === 'v2' ? 'v2' : 'classic'; } catch { return 'classic'; }
}

export function applyUiVersion() {
  if (typeof document === 'undefined') return;
  // ?ui=new / ?ui=classic in any link switches the look (and is removed from the URL).
  try {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get('ui');
    if (wanted) {
      localStorage.setItem(keyFor(), /^(new|v2)$/i.test(wanted) ? 'v2' : 'classic');
      params.delete('ui');
      const query = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }
  } catch { /* ignore */ }
  document.documentElement.classList.toggle('ui-v2', getUiVersion() === 'v2');
}

export function setUiVersion(version) {
  try { localStorage.setItem(keyFor(), version === 'v2' ? 'v2' : 'classic'); } catch { /* storage blocked: session only */ }
  applyUiVersion();
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  const onStorage = (event) => { if (!event.key || event.key.startsWith('ppl_ui_version') || event.key === 'ppl_user') { applyUiVersion(); listener(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
};

/** 'classic' | 'v2', re-rendering when the user switches. */
export function useUiVersion() {
  return useSyncExternalStore(subscribe, getUiVersion, () => 'classic');
}

export const isNewUi = () => getUiVersion() === 'v2';
