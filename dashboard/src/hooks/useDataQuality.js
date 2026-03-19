/**
 * useDataQuality Hook
 * 
 * Fetches data quality metrics from Dashboard API.
 * Auto-refreshes every 5 minutes.
 * 
 * Requirements: 11.2, 13.1
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Custom hook for fetching data quality metrics
 * 
 * @param {number} days - Number of days of history (default: 30)
 * @param {Object} options - Additional hook options
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @param {number} options.refetchInterval - Refetch interval in ms (default: 300000 = 5 minutes)
 * @returns {Object} React Query result with data, loading, error states, and refetch function
 */
export const useDataQuality = (
  days = 30,
  {
    enabled = true,
    refetchInterval = 5 * 60 * 1000 // 5 minutes
  } = {}
) => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['dataQuality', days],
    queryFn: () => api.monitoring.getDataQuality(days),
    enabled,
    refetchInterval, // Auto-refresh every 5 minutes (Req 13.1)
    staleTime: 4 * 60 * 1000, // Consider data stale after 4 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  
  /**
   * Manually refresh data quality metrics
   * Invalidates the query cache and triggers a refetch
   */
  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['dataQuality'] });
  };
  
  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error?.message,
    refetch
  };
};

export default useDataQuality;
