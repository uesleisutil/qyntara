import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * StockSelector - Stock selection with search and autocomplete
 * 
 * Features:
 * - Search/filter functionality
 * - Autocomplete dropdown
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Click outside to close
 */
const StockSelector = ({ value, onChange, stocks = [], placeholder = 'Search stocks...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Default stock list if none provided
  const defaultStocks = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3', 'MGLU3', 'WEGE3', 'RENT3', 'LREN3', 'SUZB3'];
  const stockList = stocks.length > 0 ? stocks : defaultStocks;

  // Filter stocks based on search term
  const filteredStocks = stockList.filter(stock =>
    stock.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredStocks.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredStocks.length) {
          handleSelect(filteredStocks[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleSelect = (stock) => {
    onChange(stock);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    onChange(null);
    setSearchTerm('');
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Stock Symbol
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value || searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && filteredStocks.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredStocks.map((stock, index) => (
            <button
              key={stock}
              onClick={() => handleSelect(stock)}
              className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors ${
                index === highlightedIndex ? 'bg-blue-100' : ''
              } ${value === stock ? 'bg-blue-50 font-medium' : ''}`}
            >
              {stock}
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && searchTerm && filteredStocks.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg px-3 py-2 text-gray-500 text-sm">
          No stocks found
        </div>
      )}
    </div>
  );
};

StockSelector.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  stocks: PropTypes.arrayOf(PropTypes.string),
  placeholder: PropTypes.string
};

export default StockSelector;
