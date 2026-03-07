/**
 * Type definitions for drift detection
 */

export interface FeatureDrift {
  feature: string;
  date: string;
  pValue: number;
  driftDetected: boolean;
  ksStatistic?: number;
}

export interface DriftEvent {
  date: string;
  type: 'performance' | 'feature' | 'data';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DriftStatus {
  performance_drift: boolean;
  feature_drift_count: number;
  baseline_mape: number;
  current_mape: number;
  mape_change_percentage: number;
  mape_history: Array<{
    date: string;
    current: number;
    baseline: number;
  }>;
  all_features: FeatureDrift[];
  drifted_features: FeatureDrift[];
  drift_events: DriftEvent[];
}
