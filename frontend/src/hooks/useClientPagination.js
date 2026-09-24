import { useMemo, useState } from 'react';

// Client-side pagination for lists whose backend returns the full array
// (catalogs, doctors, agents, users, expenses, signatures, ...).
// Usage:
//   const pg = useClientPagination(filteredItems, 10);
//   <DataTable data={pg.paged} pagination={{ total: pg.total, page: pg.page,
//     limit: pg.limit, pages: pg.pages, onPageChange: pg.goToPage }} />
// Call pg.reset() (or goToPage(1)) whenever a filter/search changes.
const useClientPagination = (items = [], initialLimit = 10) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), pages);

  const paged = useMemo(
    () => list.slice((safePage - 1) * limit, safePage * limit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, safePage, limit]
  );

  const goToPage = (p) => setPage(Math.max(1, Number(p) || 1));
  const reset = () => setPage(1);
  const changeLimit = (n) => {
    setLimit(Math.max(1, Number(n) || initialLimit));
    setPage(1);
  };

  return { page: safePage, pages, total, limit, paged, goToPage, reset, setLimit: changeLimit };
};

export default useClientPagination;
