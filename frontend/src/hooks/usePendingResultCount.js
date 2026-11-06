import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getPendingLabCases } from '../services/reportService';

// Number of lab cases still waiting for results. Refreshed every minute,
// when the window regains focus and on navigation; a count-only request.
export default function usePendingResultCount() {
  const [count, setCount] = useState(0);
  const { pathname } = useLocation();
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      getPendingLabCases({ page: 1, limit: 1, countOnly: 1 })
        .then((response) => { if (!cancelled) setCount(Number(response?.data?.pagination?.total) || 0); })
        .catch(() => { /* no reports permission or offline: no badge */ });
    };
    load();
    const timer = setInterval(load, 60 * 1000);
    window.addEventListener('focus', load);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', load); };
  }, [pathname]);
  return count;
}
