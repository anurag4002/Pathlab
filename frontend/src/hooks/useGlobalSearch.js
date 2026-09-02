import { useState, useEffect, useCallback } from 'react';
import { getPatients } from '../services/patientService';
import { getBills } from '../services/billService';

export const useGlobalSearch = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All'); // 'All' | 'Patients' | 'Bills'
  const [patients, setPatients] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setPatients([]);
    setBills([]);
    setSelectedIndex(0);
  }, []);

  const toggleSearch = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Hotkey listener for Cmd/Ctrl + K and Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeSearch]);

  // Debounced search fetcher
  useEffect(() => {
    if (!isOpen) return;

    if (query.trim().length === 0) {
      setPatients([]);
      setBills([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [patientRes, billRes] = await Promise.all([
          getPatients({ search: query, limit: 5 }),
          getBills({ search: query, limit: 5 })
        ]);

        if (patientRes.success) {
          setPatients(patientRes.data.patients || []);
        }
        if (billRes.success) {
          setBills(billRes.data.bills || []);
        }
      } catch (err) {
        console.error('Search query failed', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  return {
    isOpen,
    openSearch,
    closeSearch,
    toggleSearch,
    query,
    setQuery,
    activeCategory,
    setActiveCategory,
    patients,
    bills,
    loading,
    selectedIndex,
    setSelectedIndex
  };
};

export default useGlobalSearch;
