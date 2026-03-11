/**
 * useExplainability Hook
 * 
 * Fetches SHAP values and feature importance.
 * Handles prediction-specific queries.
 * 
 * Requirements: 13.1
 */

import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';

/**
 * Fetch feature importance from the API
 * 
 * @param {Object} params - Query parameters
 * @param {string} params.stockSymbol - Optional stock symbol filter
 * @param {number} params.topN - Number of top features to return
 * @param {string} params.bucket - S3 bucket name
 * @returns {Promise<Object>} Feature importance data
 */
const fetchFeatureImportance = async ({ stockSymbol, topN, bucket }) => {
  const params = new URLSearchParams();
  
  if (stockSymbol) params.append('stock_symbol', stockSymbol);
  if (topN) params.append('top_n', topN.toString());
  if (bucket) params.append('bucket', bucket);
  
  const response = await fetch(`${API_BASE_URL}/feature-importance?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch feature importance: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Fetch prediction details with explainability data
 * 
 * @param {Object} params - Query parameters
 * @param {string} params.stockSymbol - Stock symbol
 * @param {string} params.date - Date (YYYY-MM-DD)
 * @param {string} params.bucket - S3 bucket name
 * @returns {Promise<Object>} Prediction details with SHAP values
 */
const fetchPredictionExplainability = async ({ stockSymbol, date, bucket }) => {
  const params = new URLSearchParams();
  
  if (stockSymbol) params.append('stock_symbol', stockSymbol);
  if (date) params.append('date', date);
  if (bucket) params.append('bucket', bucket);
  
  const response = await fetch(`${API_BASE_URL}/prediction-details?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch prediction explainability: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Custom hook for fetching feature importance
 * 
 * @param {Object} options - Hook options
 * @param {string} options.stockSymbol - Optional stock symbol filter
 * @param {number} options.topN - Number of top features to return (default: 20)
 * @param {string} options.bucket - S3 bucket name
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @returns {Object} React Query result with data, loading, error states
 */
export const useFeatureImportance = ({
  stockSymbol = null,
  topN = 20,
  bucket = null,
  enabled = true
} = {}) => {
  return useQuery({
    queryKey: ['featureImportance', stockSymbol, topN, bucket],
    queryFn: () => fetchFeatureImportance({ stockSymbol, topN, bucket }),
    enabled,
    staleTime: 15 * 60 * 1000, // Cache for 15 minutes
    cacheTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};

/**
 * Custom hook for fetching prediction explainability
 * 
 * @param {Object} options - Hook options
 * @param {string} options.stockSymbol - Stock symbol (required)
 * @param {string} options.date - Date (YYYY-MM-DD, default: today)
 * @param {string} options.bucket - S3 bucket name
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @returns {Object} React Query result with data, loading, error states
 */
export const usePredictionExplainability = ({
  stockSymbol,
  date = new Date().toISOString().split('T')[0],
  bucket = null,
  enabled = true
} = {}) => {
  return useQuery({
    queryKey: ['predictionExplainability', stockSymbol, date, bucket],
    queryFn: () => fetchPredictionExplainability({ stockSymbol, date, bucket }),
    enabled: enabled && !!stockSymbol, // Only fetch if stock symbol is provided
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};

/**
 * Custom hook for fetching all explainability data
 * Combines feature importance and prediction explainability
 * 
 * @param {Object} options - Hook options
 * @param {string} options.stockSymbol - Stock symbol
 * @param {string} options.date - Date (YYYY-MM-DD, default: today)
 * @param {number} options.topN - Number of top features to return (default: 20)
 * @param {string} options.bucket - S3 bucket name
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @returns {Object} Combined explainability data
 */
export const useExplainability = ({
  stockSymbol = null,
  date = new Date().toISOString().split('T')[0],
  topN = 20,
  bucket = null,
  enabled = true
} = {}) => {
  const featureImportanceQuery = useFeatureImportance({ 
    stockSymbol, 
    topN, 
    bucket, 
    enabled 
  });
  
  const predictionExplainabilityQuery = usePredictionExplainability({ 
    stockSymbol, 
    date, 
    bucket, 
    enabled: enabled && !!stockSymbol 
  });
  
  // Combine both queries
  const isLoading = featureImportanceQuery.isLoading || predictionExplainabilityQuery.isLoading;
  const isError = featureImportanceQuery.isError || predictionExplainabilityQuery.isError;
  const error = featureImportanceQuery.error || predictionExplainabilityQuery.error;
  
  return {
    data: {
      featureImportance: featureImportanceQuery.data,
      predictionDetails: predictionExplainabilityQuery.data
    },
    isLoading,
    isError,
    error,
    refetch: () => {
      featureImportanceQuery.refetch();
      predictionExplainabilityQuery.refetch();
    }
  };
};

export default useExplainability;
