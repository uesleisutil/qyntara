/**
 * Type definitions for performance metrics
 */

export interface ModelMetrics {
  mape: number;
  coverage: number;
  interval_width: number;
  mae?: number;
  rmse?: number;
}

export interface TimeSeriesMetric {
  date: string;
  ensemble?: number;
  deepar?: number;
  lstm?: number;
  prophet?: number;
  transformer?: number;
  upper?: number;
  lower?: number;
}

export interface PerformanceMetrics {
  ensemble_mape: number;
  coverage: number;
  interval_width: number;
  top_performers_count: number;
  mape_trend: 'improving' | 'stable' | 'degrading';
  coverage_trend: 'improving' | 'stable' | 'degrading';
  interval_trend: 'improving' | 'stable' | 'degrading';
  mape_history: TimeSeriesMetric[];
  coverage_history: TimeSeriesMetric[];
  model_comparison: Record<string, ModelMetrics>;
  stock_metrics?: StockMetrics;
}

export interface StockMetrics {
  stock_symbol: string;
  mape: number;
  coverage: number;
  interval_width: number;
  rank: number;
  rank_change: number;
}
