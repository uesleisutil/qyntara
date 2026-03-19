import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export interface FilterState {
  sector?: string;
  minScore?: number;
  minReturn?: number;
  maxReturn?: number;
  dateRange?: { start: string; end: string };
  [key: string]: any;
}

interface FilterContextType {
  filters: FilterState;
  setFilter: (key: string, value: any) => void;
  clearFilter: (key: string) => void;
  clearAllFilters: () => void;
  applyFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

/**
 * Parses URL parameters into filter state
 * Supports both simple values and JSON-encoded objects
 */
const parseUrlFilters = (): FilterState => {
  const params = new URLSearchParams(window.location.search);
  const urlFilters: FilterState = {};
  
  params.forEach((value, key) => {
    try {
      // Try to parse as JSON first (for objects and numbers)
      urlFilters[key] = JSON.parse(value);
    } catch {
      // Fall back to string value
      urlFilters[key] = value;
    }
  });
  
  return urlFilters;
};

/**
 * Loads filters from session storage
 * Returns null if no stored filters or parsing fails
 */
const loadStoredFilters = (): FilterState | null => {
  try {
    const stored = sessionStorage.getItem('dashboardFilters');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to parse stored filters:', e);
  }
  return null;
};

/**
 * Saves filters to session storage
 */
const saveFiltersToStorage = (filters: FilterState): void => {
  try {
    sessionStorage.setItem('dashboardFilters', JSON.stringify(filters));
  } catch (e) {
    console.warn('Failed to save filters to session storage:', e);
  }
};

/**
 * Synchronizes filters to URL parameters for sharing (Req 1.7)
 */
const syncFiltersToUrl = (filters: FilterState): void => {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // Serialize objects as JSON, primitives as strings
      const serialized = typeof value === 'object' 
        ? JSON.stringify(value) 
        : String(value);
      params.set(key, serialized);
    }
  });
  
  // Update URL without triggering navigation
  const newUrl = params.toString() 
    ? `${window.location.pathname}?${params.toString()}` 
    : window.location.pathname;
  
  window.history.replaceState({}, '', newUrl);
};

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize filters from URL first (for sharing), then session storage (Req 1.7)
  const [filters, setFilters] = useState<FilterState>(() => {
    // Priority 1: URL parameters (for shared links)
    const urlFilters = parseUrlFilters();
    if (Object.keys(urlFilters).length > 0) {
      return urlFilters;
    }
    
    // Priority 2: Session storage (for persistence within session)
    const storedFilters = loadStoredFilters();
    if (storedFilters) {
      return storedFilters;
    }
    
    // Priority 3: Empty state
    return {};
  });

  // Persist filters to session storage whenever they change (Req 1.7)
  useEffect(() => {
    saveFiltersToStorage(filters);
  }, [filters]);

  // Automatically sync filters to URL for sharing (Req 1.7)
  useEffect(() => {
    syncFiltersToUrl(filters);
  }, [filters]);

  // Listen for browser back/forward navigation to update filters from URL
  useEffect(() => {
    const handlePopState = () => {
      const urlFilters = parseUrlFilters();
      setFilters(urlFilters);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setFilter = useCallback((key: string, value: any) => {
    setFilters((prev) => {
      // Filter composition: multiple filters work together (Req 1.5)
      // Each filter is independent and they combine via intersection
      const newFilters = {
        ...prev,
        [key]: value,
      };
      
      // Remove undefined values to keep state clean
      if (value === undefined) {
        delete newFilters[key];
      }
      
      return newFilters;
    });
  }, []);

  const clearFilter = useCallback((key: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({});
    sessionStorage.removeItem('dashboardFilters');
    // Clear URL parameters as well
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const applyFilters = useCallback(() => {
    // This method is now redundant since filters auto-sync to URL
    // Kept for backward compatibility
    syncFiltersToUrl(filters);
  }, [filters]);

  return (
    <FilterContext.Provider
      value={{
        filters,
        setFilter,
        clearFilter,
        clearAllFilters,
        applyFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = (): FilterContextType => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};
