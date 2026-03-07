/**
 * useModels Hook
 * 
 * Fetches model metadata and comparison data.
 * Caches model information.
 * 
 * Requirements: 13.1
 */

import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

/**
 * Fetch ensemble weights from the API
 * 
 * @param {Object} params - Query parameters
 * @param {string} params.stockSymbol - Optional stock symbol filter
 * @param {number} params.lookbackDays - Number of days of history
 * @param {string} params.bucket - S3 bucket name
 * @returns {Promise<Object>} Ensemble weights data
 */
const fetchEnsembleWeights = async ({ stockSymbol, lookbackDays, bucket }) => {
  const params = new URLSearchParams();
  
  if (stockSymbol) params.append('stock_symbol', stockSymbol);
  if (lookbackDays) params.append('lookback_days', lookbackDays.toString());
  if (bucket) params.append('bucket', bucket);
  
  const response = await fetch(`${API_BASE_URL}/ensemble-weights?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ensemble weights: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Fetch hyperparameter history from the API
 * 
 * @param {Object} params - Query parameters
 * @param {string} params.modelType - Type of model (deepar, lstm, prophet, xgboost)
 * @param {string} params.bucket - S3 bucket name
 * @returns {Promise<Object>} Hyperparameter history
 */
const fetchHyperparameterHistory = async ({ modelType, bucket }) => {
  const params = new URLSearchParams();
  
  if (modelType) params.append('model_type', modelType);
  if (bucket) params.append('bucket', bucket);
  
  const response = await fetch(`${API_BASE_URL}/hyperparameter-history?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch hyperparameter history: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Custom hook for fetching ensemble weights
 * 
 * @param {Object} options - Hook options
 * @param {string} options.stockSymbol - Optional stock symbol filter
 * @param {number} options.lookbackDays - Number of days of history (default: 90)
 * @param {string} options.bucket - S3 bucket name
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @returns {Object} React Query result with data, loading, error states
 */
export const useEnsembleWeights = ({
  stockSymbol = null,
  lookbackDays = 90,
  bucket = null,
  enabled = true
} = {}) => {
  return useQuery({
    queryKey: ['ensembleWeights', stockSymbol, lookbackDays, bucket],
    queryFn: () => fetchEnsembleWeights({ stockSymbol, lookbackDays, bucket }),
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    cacheTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};

/**
 * Custom hook for fetching hyperparameter history
 * 
 * @param {Object} options - Hook options
 * @param {string} options.modelType - Type of model (deepar, lstm, prophet, xgboost)
 * @param {string} options.bucket - S3 bucket name
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @returns {Object} React Query result with data, loading, error states
 */
export const useHyperparameterHistory = ({
  modelType = 'lstm',
  bucket = null,
  enabled = true
} = {}) => {
  return useQuery({
    queryKey: ['hyperparameterHistory', modelType, bucket],
    queryFn: () => fetchHyperparameterHistory({ modelType, bucket }),
    enabled,
    staleTime: 60 * 60 * 1000, // Cache for 1 hour (hyperparameters change infrequently)
    cacheTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};

/**
 * Custom hook for fetching all model metadata
 * Combines ensemble weights and hyperparameter data
 * 
 * @param {Object} options - Hook options
 * @param {string} options.stockSymbol - Optional stock symbol filter
 * @param {number} options.lookbackDays - Number of days of history (default: 90)
 * @param {string} options.bucket - S3 bucket name
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @returns {Object} Combined model metadata
 */
export const useModels = ({
  stockSymbol = null,
  lookbackDays = 90,
  bucket = null,
  enabled = true
} = {}) => {
  const weightsQuery = useEnsembleWeights({ stockSymbol, lookbackDays, bucket, enabled });
  
  // Fetch hyperparameters for all model types
  const deeparHpQuery = useHyperparameterHistory({ modelType: 'deepar', bucket, enabled });
  const lstmHpQuery = useHyperparameterHistory({ modelType: 'lstm', bucket, enabled });
  const prophetHpQuery = useHyperparameterHistory({ modelType: 'prophet', bucket, enabled });
  const xgboostHpQuery = useHyperparameterHistory({ modelType: 'xgboost', bucket, enabled });
  
  // Combine all queries
  const isLoading = weightsQuery.isLoading || 
                    deeparHpQuery.isLoading || 
                    lstmHpQuery.isLoading || 
                    prophetHpQuery.isLoading || 
                    xgboostHpQuery.isLoading;
  
  const isError = weightsQuery.isError || 
                  deeparHpQuery.isError || 
                  lstmHpQuery.isError || 
                  prophetHpQuery.isError || 
                  xgboostHpQuery.isError;
  
  const error = weightsQuery.error || 
                deeparHpQuery.error || 
                lstmHpQuery.error || 
                prophetHpQuery.error || 
                xgboostHpQuery.error;
  
  return {
    data: {
      weights: weightsQuery.data,
      hyperparameters: {
        deepar: deeparHpQuery.data,
        lstm: lstmHpQuery.data,
        prophet: prophetHpQuery.data,
        xgboost: xgboostHpQuery.data
      }
    },
    isLoading,
    isError,
    error,
    refetch: () => {
      weightsQuery.refetch();
      deeparHpQuery.refetch();
      lstmHpQuery.refetch();
      prophetHpQuery.refetch();
      xgboostHpQuery.refetch();
    }
  };
};

export default useModels;
