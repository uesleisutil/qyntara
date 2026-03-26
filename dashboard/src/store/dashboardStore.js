import { create } from 'zustand';

/**
 * Dashboard State Management Store
 * 
 * Manages global state for the B3 Model Optimization Dashboard including:
 * - Selected stock and date range filters
 * - Model selection for comparison views
 * - Theme and UI preferences
 * 
 * Uses Zustand for lightweight, performant state management.
 */
const useDashboardStore = create((set) => ({
  // Selected stock filter (null = all stocks)
  selectedStock: null,
  
  // Date range for filtering metrics and predictions
  dateRange: {
    start: '2024-01-01',
    end: '2024-12-31'
  },
  
  // Models selected for comparison (ensemble + individual models)
  selectedModels: ['ensemble', 'transformer_bilstm', 'tab_transformer', 'ft_transformer'],
  
  // Theme preference (light/dark mode)
  theme: 'light',
  
  // UI preferences
  preferences: {
    showConfidenceBands: true,
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    alertsOnly: false,
    topN: 20 // Number of items to show in top-N lists
  },
  
  // Actions for updating state
  
  /**
   * Set the selected stock symbol
   * @param {string|null} stock - Stock symbol (e.g., 'PETR4') or null for all stocks
   */
  setSelectedStock: (stock) => set({ selectedStock: stock }),
  
  /**
   * Set the date range for filtering
   * @param {Object} range - Date range object with start and end dates
   * @param {string} range.start - Start date in YYYY-MM-DD format
   * @param {string} range.end - End date in YYYY-MM-DD format
   */
  setDateRange: (range) => set({ dateRange: range }),
  
  /**
   * Toggle a model in the selected models list
   * @param {string} model - Model name to toggle ('ensemble', 'transformer_bilstm', 'tab_transformer', 'ft_transformer')
   */
  toggleModel: (model) => set((state) => ({
    selectedModels: state.selectedModels.includes(model)
      ? state.selectedModels.filter(m => m !== model)
      : [...state.selectedModels, model]
  })),
  
  /**
   * Set all selected models at once
   * @param {string[]} models - Array of model names
   */
  setSelectedModels: (models) => set({ selectedModels: models }),
  
  /**
   * Set the theme (light/dark mode)
   * @param {string} theme - Theme name ('light' or 'dark')
   */
  setTheme: (theme) => set({ theme }),
  
  /**
   * Update UI preferences
   * @param {Object} newPreferences - Partial preferences object to merge
   */
  updatePreferences: (newPreferences) => set((state) => ({
    preferences: {
      ...state.preferences,
      ...newPreferences
    }
  })),
  
  /**
   * Reset all filters to default values
   */
  resetFilters: () => set({
    selectedStock: null,
    dateRange: {
      start: '2024-01-01',
      end: '2024-12-31'
    },
    selectedModels: ['ensemble', 'transformer_bilstm', 'tab_transformer', 'ft_transformer']
  }),
  
  /**
   * Reset all state to initial values
   */
  reset: () => set({
    selectedStock: null,
    dateRange: {
      start: '2024-01-01',
      end: '2024-12-31'
    },
    selectedModels: ['ensemble', 'transformer_bilstm', 'tab_transformer', 'ft_transformer'],
    theme: 'light',
    preferences: {
      showConfidenceBands: true,
      autoRefresh: true,
      refreshInterval: 30000,
      alertsOnly: false,
      topN: 20
    }
  })
}));

export default useDashboardStore;
