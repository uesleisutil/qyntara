/**
 * Tests for useDrift hook
 */

import { renderHook } from '@testing-library/react';
import React from 'react';

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));

const { useQuery, useQueryClient } = require('@tanstack/react-query');

// Mock fetch
global.fetch = jest.fn();

describe('useDrift', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useQueryClient
    useQueryClient.mockReturnValue({
      invalidateQueries: jest.fn(),
    });
  });

  it('should call useQuery with correct parameters', () => {
    useQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
    });

    const { useDrift } = require('./useDrift');

    renderHook(() => useDrift({
      days: 30,
    }));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['drift', 30],
        enabled: true,
        refetchInterval: 300000,
        staleTime: 240000,
      })
    );
  });

  it('should return query result with refresh function', () => {
    const mockData = {
      drift_events: [],
      current_status: { performance: false, feature: false },
      lookback_days: 30
    };

    useQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
      error: null,
    });

    const { useDrift } = require('./useDrift');

    const { result } = renderHook(() => useDrift());

    expect(result.current.data).toEqual(mockData);
    expect(result.current.refresh).toBeDefined();
    expect(typeof result.current.refresh).toBe('function');
  });

  it('should call invalidateQueries when refresh is called', () => {
    const mockInvalidate = jest.fn();
    useQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidate,
    });

    useQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    const { useDrift } = require('./useDrift');

    const { result } = renderHook(() => useDrift());

    result.current.refresh();

    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['drift'] });
  });
});
