/**
 * useRecommendations Hook
 * 
 * Fetches latest recommendations from Dashboard API.
 * Auto-refreshes every 5 minutes.
 * 
 * Requirements: 10.2, 13.1
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Custom hook for fetching latest recommendations
 * 
 * @param {Object} options - Hook options
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @param {number} options.refetchInterval - Refetch interval in ms (default: 300000 = 5 minutes)
 * @returns {Object} React Query result with data, loading, error states, and refresh function
 */
export const useRecommendations = ({
  enabled = true,
  refetchInterval = 5 * 60 * 1000 // 5 minutes
} = {}) => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['recommendations', 'latest'],
    queryFn: () => api.recommendations.getLatest(),
    enabled,
    refetchInterval, // Auto-refresh every 5 minutes (Req 13.1)
    staleTime: 4 * 60 * 1000, // Consider data stale after 4 minutes (Req 13.1)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  
  /**
   * Manually refresh recommendations
   * Invalidates the query cache and triggers a refetch
   */
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['recommendations'] });
  };
  
  return {
    ...query,
    refresh
  };
};

export default useRecommendations;
