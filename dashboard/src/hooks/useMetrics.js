/**
 * useMetrics Hook
 * 
 * Fetches performance metrics with React Query.
 * Auto-refreshes every 30 seconds.
 * 
 * Requirements: 13.1
 */

import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

/**
 * Fetch performance metrics from the API
 * 
 * @param {Object} params - Query parameters
 * @param {string} params.stockSymbol - Optional stock symbol filter
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @param {string} params.bucket - S3 bucket name
 * @returns {Promise<Object>} Performance metrics data
 */
const fetchMetrics = async ({ stockSymbol, startDate, endDate, bucket }) => {
  const params = new URLSearchParams();
  
  if (stockSymbol) params.append('stock_symbol', stockSymbol);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (bucket) params.append('bucket', bucket);
  
  const response = await fetch(`${API_BASE_URL}/metrics?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Custom hook for fetching performance metrics
 * 
 * @param {Object} options - Hook options
 * @param {string} options.stockSymbol - Optional stock symbol filter
 * @param {string} options.startDate - Start date (YYYY-MM-DD)
 * @param {string} options.endDate - End date (YYYY-MM-DD)
 * @param {string} options.bucket - S3 bucket name
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @param {number} options.refetchInterval - Refetch interval in ms (default: 30000)
 * @returns {Object} React Query result with data, loading, error states
 */
export const useMetrics = ({
  stockSymbol = null,
  startDate = null,
  endDate = null,
  bucket = null,
  enabled = true,
  refetchInterval = 30000
} = {}) => {
  return useQuery({
    queryKey: ['metrics', stockSymbol, startDate, endDate, bucket],
    queryFn: () => fetchMetrics({ stockSymbol, startDate, endDate, bucket }),
    enabled,
    refetchInterval, // Auto-refresh every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export default useMetrics;
