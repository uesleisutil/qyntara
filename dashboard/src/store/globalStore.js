/**
 * Global Store using Zustand
 * 
 * Manages global dashboard state including:
 * - Active tab
 * - Auto-refresh settings
 * - Last update timestamp
 * 
 * Requirements: 13.1, 13.3
 */

import { create } from 'zustand';

const useGlobalStore = create((set) => ({
  // Active tab state
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // Auto-refresh state
  autoRefreshEnabled: true,
  autoRefreshInterval: 5 * 60 * 1000, // 5 minutes (Req 13.1)
  setAutoRefreshEnabled: (enabled) => set({ autoRefreshEnabled: enabled }),
  setAutoRefreshInterval: (interval) => set({ autoRefreshInterval: interval }),
  
  // Last update timestamp (Req 13.3)
  lastUpdated: null,
  setLastUpdated: (timestamp) => set({ lastUpdated: timestamp }),
  
  // Loading state
  isRefreshing: false,
  setIsRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
  
  // Error state
  error: null,
  errorType: 'general',
  setError: (error, errorType = 'general') => set({ error, errorType }),
  clearError: () => set({ error: null, errorType: 'general' }),
}));

export default useGlobalStore;
