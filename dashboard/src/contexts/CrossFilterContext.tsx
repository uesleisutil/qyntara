import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CrossFilterContextType, CrossFilter } from '../types/crossfilter';

const CrossFilterContext = createContext<CrossFilterContextType | undefined>(undefined);

export const useCrossFilter = (): CrossFilterContextType => {
  const context = useContext(CrossFilterContext);
  if (!context) {
    throw new Error('useCrossFilter must be used within a CrossFilterProvider');
  }
  return context;
};

interface CrossFilterProviderProps {
  children: ReactNode;
}

export const CrossFilterProvider: React.FC<CrossFilterProviderProps> = ({ children }) => {
  const [filters, setFilters] = useState<CrossFilter[]>([]);

  const addFilter = useCallback((filter: Omit<CrossFilter, 'id' | 'appliedAt'>) => {
    const newFilter: CrossFilter = {
      ...filter,
      id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      appliedAt: new Date().toISOString()
    };

    setFilters((prev) => {
      // Remove existing filter from the same source chart
      const filtered = prev.filter((f) => f.sourceChart !== filter.sourceChart);
      return [...filtered, newFilter];
    });
  }, []);

  const removeFilter = useCallback((filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const getActiveFilters = useCallback((): CrossFilter[] => {
    return filters;
  }, [filters]);

  const getFilteredData = useCallback(<T,>(
    data: T[],
    filterFn: (item: T, filters: CrossFilter[]) => boolean
  ): T[] => {
    if (filters.length === 0) {
      return data;
    }
    return data.filter((item) => filterFn(item, filters));
  }, [filters]);

  return (
    <CrossFilterContext.Provider
      value={{
        filters,
        addFilter,
        removeFilter,
        clearAllFilters,
        getActiveFilters,
        getFilteredData,
        hasActiveFilters: filters.length > 0,
        filterCount: filters.length
      }}
    >
      {children}
    </CrossFilterContext.Provider>
  );
};

export default CrossFilterContext;
