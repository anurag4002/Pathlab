import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, X } from 'lucide-react';

// New look: on a list page the top-bar search filters that list (one search
// box instead of two). It types into the page's own search field, which is
// hidden, so each page keeps its own search logic.
const PAGE_SEARCH = ['main [data-page-search]', 'main .afb-v2-row input[data-filter-text]', 'main .data-table-search-input'];

export function findPageSearch() {
  for (const selector of PAGE_SEARCH) {
    const input = [...document.querySelectorAll(selector)].find((el) => !el.disabled);
    if (input) return input;
  }
  return null;
}

// React tracks input values itself: set through the native setter, then fire
// "input" so the page's onChange runs as if the user typed there.
function typeInto(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function PageSearchField({ onTargetChange, onSearchEverywhere }) {
  const { pathname } = useLocation();
  const [target, setTarget] = useState(null);
  const [value, setValue] = useState('');
  const fieldRef = useRef(null);

  // Find the page's search box after each navigation (screens load lazily).
  useEffect(() => {
    let previous = null;
    const attach = () => {
      const found = findPageSearch();
      if (found === previous && (!found || found.isConnected)) return;
      previous?.closest('.data-table-search, .afb-field, .form-group')?.classList.remove('is-driven-by-header');
      previous = found;
      found?.closest('.data-table-search, .afb-field, .form-group')?.classList.add('is-driven-by-header');
      setTarget(found);
      setValue(found?.value || '');
      onTargetChange?.(!!found);
    };
    attach();
    // Watch the whole page: the <main> element itself can be swapped while
    // a screen loads. Batched to one check per frame.
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; attach(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      previous?.closest('.data-table-search, .afb-field, .form-group')?.classList.remove('is-driven-by-header');
      onTargetChange?.(false);
    };
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target || !target.isConnected) return null;
  const label = `Search this page: ${(target.getAttribute('placeholder') || target.getAttribute('aria-label') || 'this list').replace(/^search\s*(by\s*)?/i, '').replace(/\.{3}|…$/, '')}`;
  const change = (next) => { setValue(next); typeInto(target, next); };
  return (
    <div className="search-trigger header-page-search" ref={fieldRef}>
      <Search size={15} aria-hidden="true" />
      <input type="search" value={value} onChange={(event) => change(event.target.value)} placeholder={label}
        aria-label={label} data-header-page-search=""
        onKeyDown={(event) => { if (event.key === 'Escape' && value) { event.preventDefault(); change(''); } }} />
      {value ? (
        <button type="button" className="header-page-search-clear" aria-label="Clear search" onClick={() => change('')}><X size={14} /></button>
      ) : <kbd className="header-page-search-kbd" title="Press / to search this list">/</kbd>}
      {/* Same box, wider reach: patients, bills and reports anywhere (Ctrl K). */}
      {onSearchEverywhere && (
        <button type="button" className="header-page-search-all" onClick={() => onSearchEverywhere(value)} title="Search patients, bills and reports everywhere (Ctrl K)">
          Everywhere
        </button>
      )}
    </div>
  );
}
