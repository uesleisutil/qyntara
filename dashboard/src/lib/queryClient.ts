import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Recommendation data: 5 minutes cache
      staleTime: 5 * 60 * 1000,
      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Custom cache times for different data types
export const CACHE_TIMES = {
  RECOMMENDATIONS: 5 * 60 * 1000, // 5 minutes
  HISTORICAL: 60 * 60 * 1000, // 60 minutes
  PERFORMANCE: 10 * 60 * 1000, // 10 minutes
  COSTS: 30 * 60 * 1000, // 30 minutes
  DATA_QUALITY: 60 * 60 * 1000, // 60 minutes
  DRIFT: 30 * 60 * 1000, // 30 minutes
  EXPLAINABILITY: 60 * 60 * 1000, // 60 minutes
};
