import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Pop-ups and side panels that are mirrored to the address (?details=<id>,
// ?entry=<id> ...) get their own step in the browser history:
//  - opening one adds a step, so the browser's Back closes it and stays on
//    the page (instead of leaving to the previous page);
//  - closing one with its own X / Cancel steps back, so history stays clean;
//  - a reload keeps it open, and Back after a reload still just closes it.

// A step back is applied by the browser a moment later. Anything opened in
// the meantime waits for it, or the step back would undo the new pop-up.
let backPending = null;

const stepBack = (navigate) => {
  backPending = new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener('popstate', done);
      backPending = null;
      setTimeout(resolve, 0);
    };
    window.addEventListener('popstate', done);
    setTimeout(done, 600);
  });
  navigate(-1);
};

/** Returns mirror(key, isOpen, id) that keeps the address in step with a pop-up. */
export function useModalUrl(setSearchParams) {
  const navigate = useNavigate();
  // Only a pop-up opened on this page clears its key when it closes; a deep
  // link (?details=<id>) must survive until the data loads and opens it.
  const openedRef = useRef({});

  const open = (key, value) => {
    const current = new URLSearchParams(window.location.search);
    if (current.get(key) === value) return;
    // Already open for another record: swap it in place, no extra step.
    const replace = current.has(key);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      return next;
    }, { replace, state: { pplModal: key } });
  };

  return (key, isOpen, id) => {
    if (isOpen) {
      openedRef.current[key] = true;
      const value = id ? String(id) : 'open';
      if (backPending) backPending.then(() => open(key, value));
      else open(key, value);
      return;
    }
    if (!openedRef.current[key]) return;
    openedRef.current[key] = false;
    const current = new URLSearchParams(window.location.search);
    if (!current.has(key)) return;
    if (window.history.state?.usr?.pplModal === key && !backPending) {
      stepBack(navigate);
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      return next;
    }, { replace: true });
  };
}

/**
 * Closes pop-ups whose key left the address (browser Back).
 * modals: { key: [isOpen, close] }
 */
export function useCloseOnBack(searchParams, modals) {
  const modalsRef = useRef(modals);
  modalsRef.current = modals;
  const previous = useRef(searchParams);
  useEffect(() => {
    const before = previous.current;
    previous.current = searchParams;
    Object.entries(modalsRef.current).forEach(([key, [isOpen, close]]) => {
      if (isOpen && before?.has(key) && !searchParams.has(key)) close();
    });
  }, [searchParams]);
}
