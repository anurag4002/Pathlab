import { useState } from 'react';

const usePagination = (initialPage = 1, initialLimit = 10) => {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const nextPage = () => setPage(prev => prev + 1);
  const prevPage = () => setPage(prev => Math.max(1, prev - 1));
  const goToPage = (pageNumber) => setPage(pageNumber);
  // Changing rows-per-page always returns to page 1 (page counts shift).
  const changeLimit = (n) => {
    setLimit(Math.max(1, Number(n) || initialLimit));
    setPage(1);
  };

  return {
    page,
    limit,
    setPage,
    setLimit: changeLimit,
    nextPage,
    prevPage,
    goToPage
  };
};

export default usePagination;
