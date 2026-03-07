import { renderHook, act } from '@testing-library/react';
import useDashboardStore from './dashboardStore';

describe('useDashboardStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    const { result } = renderHook(() => useDashboardStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      expect(result.current.selectedStock).toBeNull();
      expect(result.current.dateRange).toEqual({
        start: '2024-01-01',
        end: '2024-12-31'
      });
      expect(result.current.selectedModels).toEqual([
        'ensemble', 'deepar', 'lstm', 'prophet', 'xgboost'
      ]);
      expect(result.current.theme).toBe('light');
      expect(result.current.preferences).toEqual({
        showConfidenceBands: true,
        autoRefresh: true,
        refreshInterval: 30000,
        alertsOnly: false,
        topN: 20
      });
    });
  });

  describe('setSelectedStock', () => {
    it('should update selected stock', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.setSelectedStock('PETR4');
      });
      
      expect(result.current.selectedStock).toBe('PETR4');
    });

    it('should set stock to null', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.setSelectedStock('PETR4');
        result.current.setSelectedStock(null);
      });
      
      expect(result.current.selectedStock).toBeNull();
    });
  });

  describe('setDateRange', () => {
    it('should update date range', () => {
      const { result } = renderHook(() => useDashboardStore());
      const newRange = { start: '2023-01-01', end: '2023-12-31' };
      
      act(() => {
        result.current.setDateRange(newRange);
      });
      
      expect(result.current.dateRange).toEqual(newRange);
    });
  });

  describe('toggleModel', () => {
    it('should remove model when already selected', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.toggleModel('ensemble');
      });
      
      expect(result.current.selectedModels).toEqual([
        'deepar', 'lstm', 'prophet', 'xgboost'
      ]);
    });

    it('should add model when not selected', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.toggleModel('ensemble');
        result.current.toggleModel('ensemble');
      });
      
      expect(result.current.selectedModels).toContain('ensemble');
    });

    it('should handle toggling multiple models', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.toggleModel('deepar');
        result.current.toggleModel('lstm');
      });
      
      expect(result.current.selectedModels).toEqual([
        'ensemble', 'prophet', 'xgboost'
      ]);
    });
  });

  describe('setSelectedModels', () => {
    it('should set all selected models at once', () => {
      const { result } = renderHook(() => useDashboardStore());
      const newModels = ['ensemble', 'lstm'];
      
      act(() => {
        result.current.setSelectedModels(newModels);
      });
      
      expect(result.current.selectedModels).toEqual(newModels);
    });

    it('should replace existing models', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.setSelectedModels(['deepar']);
      });
      
      expect(result.current.selectedModels).toEqual(['deepar']);
    });
  });

  describe('setTheme', () => {
    it('should update theme to dark', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.setTheme('dark');
      });
      
      expect(result.current.theme).toBe('dark');
    });

    it('should update theme to light', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.setTheme('dark');
        result.current.setTheme('light');
      });
      
      expect(result.current.theme).toBe('light');
    });
  });

  describe('updatePreferences', () => {
    it('should update single preference', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.updatePreferences({ showConfidenceBands: false });
      });
      
      expect(result.current.preferences.showConfidenceBands).toBe(false);
      expect(result.current.preferences.autoRefresh).toBe(true); // Other preferences unchanged
    });

    it('should update multiple preferences', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.updatePreferences({
          autoRefresh: false,
          refreshInterval: 60000,
          topN: 10
        });
      });
      
      expect(result.current.preferences).toEqual({
        showConfidenceBands: true,
        autoRefresh: false,
        refreshInterval: 60000,
        alertsOnly: false,
        topN: 10
      });
    });
  });

  describe('resetFilters', () => {
    it('should reset filters to default values', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.setSelectedStock('VALE3');
        result.current.setDateRange({ start: '2023-01-01', end: '2023-06-30' });
        result.current.setSelectedModels(['ensemble']);
        result.current.resetFilters();
      });
      
      expect(result.current.selectedStock).toBeNull();
      expect(result.current.dateRange).toEqual({
        start: '2024-01-01',
        end: '2024-12-31'
      });
      expect(result.current.selectedModels).toEqual([
        'ensemble', 'deepar', 'lstm', 'prophet', 'xgboost'
      ]);
    });

    it('should not reset theme and preferences', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.setTheme('dark');
        result.current.updatePreferences({ topN: 50 });
        result.current.resetFilters();
      });
      
      expect(result.current.theme).toBe('dark');
      expect(result.current.preferences.topN).toBe(50);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useDashboardStore());
      
      act(() => {
        result.current.setSelectedStock('PETR4');
        result.current.setDateRange({ start: '2023-01-01', end: '2023-12-31' });
        result.current.setSelectedModels(['ensemble']);
        result.current.setTheme('dark');
        result.current.updatePreferences({ topN: 50 });
        result.current.reset();
      });
      
      expect(result.current.selectedStock).toBeNull();
      expect(result.current.dateRange).toEqual({
        start: '2024-01-01',
        end: '2024-12-31'
      });
      expect(result.current.selectedModels).toEqual([
        'ensemble', 'deepar', 'lstm', 'prophet', 'xgboost'
      ]);
      expect(result.current.theme).toBe('light');
      expect(result.current.preferences).toEqual({
        showConfidenceBands: true,
        autoRefresh: true,
        refreshInterval: 30000,
        alertsOnly: false,
        topN: 20
      });
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useDashboardStore());
      
      act(() => {
        result1.current.setSelectedStock('PETR4');
      });
      
      const { result: result2 } = renderHook(() => useDashboardStore());
      
      expect(result2.current.selectedStock).toBe('PETR4');
    });
  });
});
