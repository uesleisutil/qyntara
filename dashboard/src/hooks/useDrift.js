/**
 * useDrift Hook
 * 
 * Fetches drift status with auto-refresh.
 * Provides manual refresh function.
 * 
 * Requirements: 13.1
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

/**
 * Fetch drift status from the API
 * 
 * @param {Object} params - Query parameters
 * @param {number} params.lookbackDays - Number of days to look back
 * @param {string} params.bucket - S3 bucket name
 * @returns {Promise<Object>} Drift status data
 */
const fetchDriftStatus = async ({ lookbackDays, bucket }) => {
  const params = new URLSearchParams();
  
  if (lookbackDays) params.append('lookback_days', lookbackDays.toString());
  if (bucket) params.append('bucket', bucket);
  
  const response = await fetch(`${API_BASE_URL}/drift-status?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch drift status: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Custom hook for fetching drift detection status
 * 
 * @param {Object} options - Hook options
 * @param {number} options.lookbackDays - Number of days to look back (default: 30)
 * @param {string} options.bucket - S3 bucket name
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @param {number} options.refetchInterval - Refetch interval in ms (default: 60000)
 * @returns {Object} React Query result with data, loading, error states, and refresh function
 */
export const useDrift = ({
  lookbackDays = 30,
  bucket = null,
  enabled = true,
  refetchInterval = 60000 // Auto-refresh every minute
} = {}) => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['drift', lookbackDays, bucket],
    queryFn: () => fetchDriftStatus({ lookbackDays, bucket }),
    enabled,
    refetchInterval, // Auto-refresh every minute
    staleTime: 45000, // Consider data stale after 45 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  
  /**
   * Manually refresh drift data
   * Invalidates the query cache and triggers a refetch
   */
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['drift'] });
  };
  
  return {
    ...query,
    refresh
  };
};

export default useDrift;
