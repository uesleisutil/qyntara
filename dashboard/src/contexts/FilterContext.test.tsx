/**
 * FilterContext Tests
 * 
 * Tests for filter composition and persistence (Task 3.2)
 * - Requirement 1.5: Multiple filters work together (intersection)
 * - Requirement 1.7: Filter persistence in session storage and URL
 */

import React from 'react';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { FilterProvider, useFilters, FilterState } from './FilterContext';

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock window.history
const mockHistoryReplaceState = jest.fn();
Object.defineProperty(window, 'history', {
  value: {
    replaceState: mockHistoryReplaceState,
  },
  writable: true,
});

// Helper to render hook with provider
const renderWithProvider = () => {
  return renderHook(() => useFilters(), {
    wrapper: ({ children }) => <FilterProvider>{children}</FilterProvider>,
  });
};

describe('FilterContext - Filter Composition (Req 1.5)', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    mockHistoryReplaceState.mockClear();
    // Clear URL parameters
    window.history.replaceState({}, '', window.location.pathname);
  });

  test('should allow setting multiple independent filters', () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Technology');
      result.current.setFilter('minScore', 80);
      result.current.setFilter('minReturn', 5.0);
    });

    expect(result.current.filters).toEqual({
      sector: 'Technology',
      minScore: 80,
      minReturn: 5.0,
    });
  });

  test('should maintain all filters when adding a new one (intersection)', () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Finance');
    });

    expect(result.current.filters.sector).toBe('Finance');

    act(() => {
      result.current.setFilter('minScore', 70);
    });

    // Both filters should be present (intersection)
    expect(result.current.filters).toEqual({
      sector: 'Finance',
      minScore: 70,
    });
  });

  test('should allow updating individual filters without affecting others', () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Technology');
      result.current.setFilter('minScore', 80);
      result.current.setFilter('minReturn', 5.0);
    });

    // Update one filter
    act(() => {
      result.current.setFilter('minScore', 90);
    });

    expect(result.current.filters).toEqual({
      sector: 'Technology',
      minScore: 90, // Updated
      minReturn: 5.0, // Unchanged
    });
  });

  test('should remove filter when value is undefined', () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Technology');
      result.current.setFilter('minScore', 80);
    });

    act(() => {
      result.current.setFilter('minScore', undefined);
    });

    expect(result.current.filters).toEqual({
      sector: 'Technology',
    });
    expect(result.current.filters.minScore).toBeUndefined();
  });

  test('should clear individual filter without affecting others', () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Technology');
      result.current.setFilter('minScore', 80);
      result.current.setFilter('minReturn', 5.0);
    });

    act(() => {
      result.current.clearFilter('minScore');
    });

    expect(result.current.filters).toEqual({
      sector: 'Technology',
      minReturn: 5.0,
    });
  });

  test('should clear all filters at once', () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Technology');
      result.current.setFilter('minScore', 80);
      result.current.setFilter('minReturn', 5.0);
    });

    act(() => {
      result.current.clearAllFilters();
    });

    expect(result.current.filters).toEqual({});
  });

  test('should support complex filter values (objects)', () => {
    const { result } = renderWithProvider();

    const dateRange = { start: '2024-01-01', end: '2024-12-31' };

    act(() => {
      result.current.setFilter('dateRange', dateRange);
      result.current.setFilter('sector', 'Technology');
    });

    expect(result.current.filters).toEqual({
      dateRange,
      sector: 'Technology',
    });
  });
});

describe('FilterContext - Session Storage Persistence (Req 1.7)', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    mockHistoryReplaceState.mockClear();
    window.history.replaceState({}, '', window.location.pathname);
  });

  test('should persist filters to session storage when set', async () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Technology');
      result.current.setFilter('minScore', 80);
    });

    await waitFor(() => {
      const stored = mockSessionStorage.getItem('dashboardFilters');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual({
        sector: 'Technology',
        minScore: 80,
      });
    });
  });

  test('should load filters from session storage on initialization', () => {
    // Pre-populate session storage
    mockSessionStorage.setItem(
      'dashboardFilters',
      JSON.stringify({ sector: 'Finance', minScore: 75 })
    );

    const { result } = renderWithProvider();

    expect(result.current.filters).toEqual({
      sector: 'Finance',
      minScore: 75,
    });
  });

  test('should update session storage when filters change', async () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Technology');
    });

    await waitFor(() => {
      const stored = JSON.parse(mockSessionStorage.getItem('dashboardFilters')!);
      expect(stored.sector).toBe('Technology');
    });

    act(() => {
      result.current.setFilter('minScore', 85);
    });

    await waitFor(() => {
      const stored = JSON.parse(mockSessionStorage.getItem('dashboardFilters')!);
      expect(stored).toEqual({
        sector: 'Technology',
        minScore: 85,
      });
    });
  });

  test('should clear session storage when all filters cleared', async () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Technology');
    });

    act(() => {
      result.current.clearAllFilters();
    });

    // After clearAllFilters, the useEffect persists the empty {} state
    // so session storage will contain "{}" rather than being null
    await waitFor(() => {
      const stored = mockSessionStorage.getItem('dashboardFilters');
      const parsed = stored ? JSON.parse(stored) : {};
      expect(Object.keys(parsed).length).toBe(0);
    });
  });

  test('should handle corrupted session storage gracefully', () => {
    // Set invalid JSON in session storage
    mockSessionStorage.setItem('dashboardFilters', 'invalid-json{');

    // Should not throw and should initialize with empty filters
    const { result } = renderWithProvider();
    expect(result.current.filters).toEqual({});
  });
});

describe('FilterContext - URL Synchronization (Req 1.7)', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    mockHistoryReplaceState.mockClear();
    window.history.replaceState({}, '', window.location.pathname);
  });

  test('should sync filters to URL parameters automatically', async () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Technology');
      result.current.setFilter('minScore', 80);
    });

    await waitFor(() => {
      expect(mockHistoryReplaceState).toHaveBeenCalled();
      const lastCall = mockHistoryReplaceState.mock.calls[mockHistoryReplaceState.mock.calls.length - 1];
      const url = lastCall[2] as string;
      
      expect(url).toContain('sector=Technology');
      expect(url).toContain('minScore=80');
    });
  });

  test('should load filters from URL parameters on initialization', () => {
    // Simulate URL with parameters
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?sector=Finance&minScore=75',
        pathname: '/recommendations',
      },
      writable: true,
    });

    const { result } = renderWithProvider();

    // URL params are parsed with JSON.parse, so "75" becomes number 75
    expect(result.current.filters).toEqual({
      sector: 'Finance',
      minScore: 75,
    });
  });

  test('should prioritize URL parameters over session storage', () => {
    // Set session storage
    mockSessionStorage.setItem(
      'dashboardFilters',
      JSON.stringify({ sector: 'Technology', minScore: 80 })
    );

    // Set URL parameters (should take priority)
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?sector=Finance&minScore=90',
        pathname: '/recommendations',
      },
      writable: true,
    });

    const { result } = renderWithProvider();

    expect(result.current.filters.sector).toBe('Finance');
    // URL params parsed via JSON.parse: "90" becomes number 90
    expect(result.current.filters.minScore).toBe(90);
  });

  test('should serialize complex objects to URL as JSON', async () => {
    const { result } = renderWithProvider();

    const dateRange = { start: '2024-01-01', end: '2024-12-31' };

    act(() => {
      result.current.setFilter('dateRange', dateRange);
    });

    await waitFor(() => {
      const lastCall = mockHistoryReplaceState.mock.calls[mockHistoryReplaceState.mock.calls.length - 1];
      const url = lastCall[2] as string;
      
      expect(url).toContain('dateRange=');
      expect(url).toContain(encodeURIComponent(JSON.stringify(dateRange)));
    });
  });

  test('should clear URL parameters when all filters cleared', async () => {
    const { result } = renderWithProvider();

    act(() => {
      result.current.setFilter('sector', 'Technology');
    });

    act(() => {
      result.current.clearAllFilters();
    });

    await waitFor(() => {
      const lastCall = mockHistoryReplaceState.mock.calls[mockHistoryReplaceState.mock.calls.length - 1];
      const url = lastCall[2] as string;
      
      // Should be just the pathname without query string
      expect(url).not.toContain('?');
    });
  });

  test('should handle URL parameters with special characters', () => {
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?sector=Technology%20%26%20Services',
        pathname: '/recommendations',
      },
      writable: true,
    });

    const { result } = renderWithProvider();

    expect(result.current.filters.sector).toBe('Technology & Services');
  });
});

describe('FilterContext - Integration Tests', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    mockHistoryReplaceState.mockClear();
    window.history.replaceState({}, '', window.location.pathname);
  });

  test('should maintain filter state across multiple operations', async () => {
    const { result } = renderWithProvider();

    // Set initial filters
    act(() => {
      result.current.setFilter('sector', 'Technology');
      result.current.setFilter('minScore', 80);
      result.current.setFilter('minReturn', 5.0);
    });

    // Update one filter
    act(() => {
      result.current.setFilter('minScore', 85);
    });

    // Clear one filter
    act(() => {
      result.current.clearFilter('minReturn');
    });

    // Add a new filter
    act(() => {
      result.current.setFilter('maxReturn', 15.0);
    });

    expect(result.current.filters).toEqual({
      sector: 'Technology',
      minScore: 85,
      maxReturn: 15.0,
    });

    // Verify persistence
    await waitFor(() => {
      const stored = JSON.parse(mockSessionStorage.getItem('dashboardFilters')!);
      expect(stored).toEqual({
        sector: 'Technology',
        minScore: 85,
        maxReturn: 15.0,
      });
    });
  });

  test('should support full filter lifecycle', async () => {
    const { result } = renderWithProvider();

    // 1. Set filters
    act(() => {
      result.current.setFilter('sector', 'Finance');
      result.current.setFilter('minScore', 70);
    });

    expect(result.current.filters).toEqual({
      sector: 'Finance',
      minScore: 70,
    });

    // 2. Verify persistence
    await waitFor(() => {
      const stored = JSON.parse(mockSessionStorage.getItem('dashboardFilters')!);
      expect(stored).toEqual({
        sector: 'Finance',
        minScore: 70,
      });
    });

    // 3. Update filters
    act(() => {
      result.current.setFilter('minScore', 80);
      result.current.setFilter('minReturn', 3.0);
    });

    // 4. Clear all
    act(() => {
      result.current.clearAllFilters();
    });

    expect(result.current.filters).toEqual({});
    // After clearAllFilters, useEffect re-persists empty state
    const stored = mockSessionStorage.getItem('dashboardFilters');
    const parsed = stored ? JSON.parse(stored) : {};
    expect(Object.keys(parsed).length).toBe(0);
  });
});
