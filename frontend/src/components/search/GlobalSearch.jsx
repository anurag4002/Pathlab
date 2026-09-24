import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, User, FileText } from 'lucide-react';
import useGlobalSearch from '../../hooks/useGlobalSearch';
import SearchOverlay from './SearchOverlay';
import SearchInput from './SearchInput';
import SearchCategory from './SearchCategory';
import SearchResults from './SearchResults';
import SearchResultItem from './SearchResultItem';
import formatCurrency from '../../utils/formatCurrency';
import { buildBillsSearchUrl } from '../../utils/billNavigation';
import './Search.css';

const GlobalSearch = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const {
    isOpen,
    openSearch,
    closeSearch,
    query,
    setQuery,
    activeCategory,
    setActiveCategory,
    patients,
    bills,
    loading,
    selectedIndex,
    setSelectedIndex
  } = useGlobalSearch();

  const filteredPatients = activeCategory === 'All' || activeCategory === 'Patients' ? patients : [];
  const filteredBills = activeCategory === 'All' || activeCategory === 'Bills' ? bills : [];
  const totalResults = [...filteredPatients, ...filteredBills];

  const handleSelect = (item, type) => {
    closeSearch();
    if (type === 'Patient') {
      navigate(`/cases/patients/${item._id}`);
    } else if (type === 'Bill') {
      if (!item?.billNumber) return;
      navigate(buildBillsSearchUrl(item));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalResults.length) % Math.max(1, totalResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (totalResults[selectedIndex]) {
        const item = totalResults[selectedIndex];
        const type = item.registrationNumber ? 'Patient' : 'Bill';
        handleSelect(item, type);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        className="search-trigger"
        onClick={openSearch}
        aria-label="Open global search (Cmd+K)"
      >
        <div className="search-trigger-content">
          <Search size={15} aria-hidden="true" />
          <span>Search patients, bills, reports...</span>
        </div>
        <div className="search-shortcut-badge">
          <Command size={10} />
          <span>K</span>
        </div>
      </button>

      <SearchOverlay isOpen={isOpen} onClose={closeSearch}>
        <SearchInput
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          onClose={closeSearch}
        />

        <SearchCategory
          categories={['All', 'Patients', 'Bills']}
          activeCategory={activeCategory}
          onSelect={(cat) => {
            setActiveCategory(cat);
            setSelectedIndex(0);
          }}
        />

        <SearchResults
          loading={loading}
          query={query}
          isEmpty={totalResults.length === 0}
        >
          {filteredPatients.length > 0 && (
            <div>
              <div className="search-group-header">Patients</div>
              {filteredPatients.map((pat, idx) => (
                <SearchResultItem
                  key={pat._id}
                  icon={User}
                  iconBg="var(--color-primary-light)"
                  iconColor="var(--color-primary)"
                  title={pat.name}
                  subtitle={`ID: ${pat.registrationNumber} • Phone: ${pat.phone}`}
                  badgeText="Patient"
                  isFocused={selectedIndex === idx}
                  onClick={() => handleSelect(pat, 'Patient')}
                  onMouseEnter={() => setSelectedIndex(idx)}
                />
              ))}
            </div>
          )}

          {filteredBills.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <div className="search-group-header">Bills</div>
              {filteredBills.map((bill, idx) => {
                const globalIndex = filteredPatients.length + idx;
                return (
                  <SearchResultItem
                    key={bill._id}
                    icon={FileText}
                    iconBg="var(--color-warning-bg)"
                    iconColor="var(--color-warning)"
                    title={bill.billNumber}
                    subtitle={`Patient: ${bill.patient?.name || 'Walk-in'} • Amount: ${formatCurrency(bill.totalAmount)}`}
                    badgeText="Bill"
                    badgeBg="var(--color-warning-bg)"
                    badgeColor="var(--color-warning)"
                    isFocused={selectedIndex === globalIndex}
                    onClick={() => handleSelect(bill, 'Bill')}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  />
                );
              })}
            </div>
          )}
        </SearchResults>
      </SearchOverlay>
    </>
  );
};

export default GlobalSearch;
