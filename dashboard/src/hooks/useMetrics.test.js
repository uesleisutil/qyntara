/**
 * Tests for useMetrics hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }) => children,
}));

const { useQuery } = require('@tanstack/react-query');

// Mock fetch
global.fetch = jest.fn();

describe('useMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call useQuery with correct parameters', () => {
    useQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
    });

    const { useMetrics } = require('./useMetrics');

    renderHook(() => useMetrics({
      stockSymbol: 'PETR4',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    }));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['metrics', 'PETR4', '2024-01-01', '2024-12-31', null],
        enabled: true,
        refetchInterval: 30000,
        staleTime: 20000,
      })
    );
  });

  it('should handle enabled parameter', () => {
    useQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    const { useMetrics } = require('./useMetrics');

    renderHook(() => useMetrics({ enabled: false }));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  it('should return query result', () => {
    const mockData = {
      metrics: [{ date: '2024-01-01', overall_mape: 6.5 }],
      summary: { avg_mape: 6.5 }
    };

    useQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
      error: null,
    });

    const { useMetrics } = require('./useMetrics');

    const { result } = renderHook(() => useMetrics());

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
  });
});
