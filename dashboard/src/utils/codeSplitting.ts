/**
 * Code Splitting Utilities
 * 
 * This file provides utilities for lazy loading components and routes
 * to optimize bundle size and initial load time.
 * 
 * Target: < 1MB gzipped main bundle
 */

import { lazy, ComponentType } from 'react';

/**
 * Lazy load a component with a custom loading delay
 * This helps avoid flash of loading state for fast connections
 */
export function lazyWithDelay<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  delay: number = 200
): React.LazyExoticComponent<T> {
  return lazy(() =>
    Promise.all([
      importFunc(),
      new Promise((resolve) => setTimeout(resolve, delay)),
    ]).then(([moduleExports]) => moduleExports)
  );
}

/**
 * Preload a lazy component
 * Useful for preloading likely next routes
 */
export function preloadComponent(
  importFunc: () => Promise<{ default: ComponentType<any> }>
): void {
  importFunc();
}

/**
 * Lazy load heavy libraries
 * These should be split into separate chunks
 */

// D3.js - Heavy visualization library
export const lazyD3 = () => import('d3');

// Plotly - Heavy charting library  
// @ts-ignore - plotly.js doesn't have types
export const lazyPlotly = () => import('plotly.js');

// XLSX - Heavy Excel export library
export const lazyXLSX = () => import('xlsx');

/**
 * Route-based code splitting
 * Each tab is loaded as a separate chunk
 */

// Lazy load tab components
export const LazyRecommendationsTab = lazy(
  () => import('../components/recommendations/RecommendationsPage')
);

export const LazyPerformanceTab = lazy(
  () => import('../components/charts/PerformanceTabExample')
);

export const LazyValidationTab = lazy(
  () => import('../components/validation/ValidationPage')
);

export const LazyDataQualityTab = lazy(
  () => import('../components/dataQuality/DataQualityTab')
);

export const LazyDriftDetectionTab = lazy(
  () => import('../components/driftDetection/DriftDetectionTab')
);

export const LazyExplainabilityTab = lazy(
  () => import('../components/explainability/ExplainabilityTab')
);

export const LazyBacktestingTab = lazy(
  () => import('../components/backtesting/BacktestingTab')
);

/**
 * Preload strategies
 */

// Preload next likely tab based on current tab
export const preloadNextTab = (currentTab: string): void => {
  const preloadMap: Record<string, () => void> = {
    recommendations: () => preloadComponent(() => import('../components/charts/PerformanceTabExample')),
    performance: () => preloadComponent(() => import('../components/validation/ValidationPage')),
    validation: () => preloadComponent(() => import('../components/backtesting/BacktestingTab')),
    dataQuality: () => preloadComponent(() => import('../components/driftDetection/DriftDetectionTab')),
    driftDetection: () => preloadComponent(() => import('../components/explainability/ExplainabilityTab')),
    explainability: () => preloadComponent(() => import('../components/backtesting/BacktestingTab')),
  };

  const preloadFunc = preloadMap[currentTab];
  if (preloadFunc) {
    // Delay preload to avoid competing with current tab loading
    setTimeout(preloadFunc, 1000);
  }
};
