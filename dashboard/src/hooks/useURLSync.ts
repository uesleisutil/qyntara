import { useEffect } from 'react';
import { useFilters } from '@contexts/FilterContext';

/**
 * Hook to synchronize filters with URL parameters for shareable state
 */
export const useURLSync = () => {
  const { filters, setFilter } = useFilters();

  // Load filters from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.forEach((value, key) => {
      try {
        // Try to parse as JSON for complex values
        const parsed = JSON.parse(value);
        setFilter(key, parsed);
      } catch {
        // Use as string if not valid JSON
        setFilter(key, value);
      }
    });
  }, [setFilter]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    
    const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newURL);
  }, [filters]);
};
