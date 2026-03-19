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

export interface FeatureDriftData {
  feature: string;
  ksStatistic: number;
  pValue: number;
  drifted: boolean;
  magnitude: number;
  currentDistribution: number[];
  baselineDistribution: number[];
}

export interface DriftEvent {
  date: string;
  type: 'performance' | 'feature' | 'data';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ConceptDriftData {
  feature: string;
  currentCorrelation: number;
  baselineCorrelation: number;
  change: number;
  drifted: boolean;
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
  data_drift?: FeatureDriftData[];
  concept_drift?: ConceptDriftData[];
  performance_degradation?: PerformanceDegradation[];
}

export interface PerformanceDegradation {
  metric: string;
  current: number;
  baseline: number;
  change: number;
  changePercentage: number;
  degraded: boolean;
  duration: number; // days
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  firstDetected?: string;
}
