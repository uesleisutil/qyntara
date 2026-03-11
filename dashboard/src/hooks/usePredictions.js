/**
 * usePredictions Hook
 * 
 * Fetches predictions with caching.
 * Filters by stock and date range.
 * 
 * Requirements: 13.1
 */

import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';

/**
 * Fetch prediction details from the API
 * 
 * @param {Object} params - Query parameters
 * @param {string} params.stockSymbol - Stock symbol
 * @param {string} params.date - Date (YYYY-MM-DD)
 * @param {string} params.bucket - S3 bucket name
 * @returns {Promise<Object>} Prediction details
 */
const fetchPredictionDetails = async ({ stockSymbol, date, bucket }) => {
  const params = new URLSearchParams();
  
  if (stockSymbol) params.append('stock_symbol', stockSymbol);
  if (date) params.append('date', date);
  if (bucket) params.append('bucket', bucket);
  
  const response = await fetch(`${API_BASE_URL}/prediction-details?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch predictions: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Fetch model comparison data from the API
 * 
 * @param {Object} params - Query parameters
 * @param {string} params.stockSymbol - Optional stock symbol filter
 * @param {string} params.date - Date (YYYY-MM-DD)
 * @param {string} params.bucket - S3 bucket name
 * @returns {Promise<Object>} Model comparison data
 */
const fetchModelComparison = async ({ stockSymbol, date, bucket }) => {
  const params = new URLSearchParams();
  
  if (stockSymbol) params.append('stock_symbol', stockSymbol);
  if (date) params.append('date', date);
  if (bucket) params.append('bucket', bucket);
  
  const response = await fetch(`${API_BASE_URL}/model-comparison?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch model comparison: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Custom hook for fetching prediction details
 * 
 * @param {Object} options - Hook options
 * @param {string} options.stockSymbol - Stock symbol (required)
 * @param {string} options.date - Date (YYYY-MM-DD, default: today)
 * @param {string} options.bucket - S3 bucket name
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @returns {Object} React Query result with data, loading, error states
 */
export const usePredictions = ({
  stockSymbol,
  date = new Date().toISOString().split('T')[0],
  bucket = null,
  enabled = true
} = {}) => {
  return useQuery({
    queryKey: ['predictions', stockSymbol, date, bucket],
    queryFn: () => fetchPredictionDetails({ stockSymbol, date, bucket }),
    enabled: enabled && !!stockSymbol, // Only fetch if stock symbol is provided
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};

/**
 * Custom hook for fetching model comparison data
 * 
 * @param {Object} options - Hook options
 * @param {string} options.stockSymbol - Optional stock symbol filter
 * @param {string} options.date - Date (YYYY-MM-DD, default: today)
 * @param {string} options.bucket - S3 bucket name
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @returns {Object} React Query result with data, loading, error states
 */
export const useModelComparison = ({
  stockSymbol = null,
  date = new Date().toISOString().split('T')[0],
  bucket = null,
  enabled = true
} = {}) => {
  return useQuery({
    queryKey: ['modelComparison', stockSymbol, date, bucket],
    queryFn: () => fetchModelComparison({ stockSymbol, date, bucket }),
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};

export default usePredictions;
