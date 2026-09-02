import { useState, useEffect, useCallback } from 'react';

const useFetch = (fetchFunc, immediate = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFunc(...args);
      setData(response);
      return response;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Something went wrong';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchFunc]);

  useEffect(() => {
    if (immediate) {
      execute().catch(() => {});
    }
  }, [immediate, execute]);

  return { data, loading, error, execute, setData };
};

export default useFetch;
