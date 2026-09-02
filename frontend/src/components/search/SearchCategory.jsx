import React from 'react';
import './Search.css';

const SearchCategory = ({ categories = ['All', 'Patients', 'Bills'], activeCategory, onSelect }) => {
  return (
    <div className="search-categories">
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          className={`search-category-btn ${activeCategory === cat ? 'active' : ''}`}
          onClick={() => onSelect(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
};

export default SearchCategory;
