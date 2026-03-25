/**
 * Type definitions for DL ensemble insights (3 models)
 */

export interface EnsembleWeights {
  date: string;
  transformer_bilstm: number;
  residual_mlp: number;
  temporal_cnn: number;
}

export interface ModelContribution {
  model: string;
  value: number;
}

export interface PredictionBreakdown {
  model: string;
  prediction: number;
  weight: number;
  contribution: number;
}

export interface IndividualModelMetrics {
  rmse: number;
  mae: number;
  mape: number;
  directional_accuracy?: number;
}

export interface EnsembleInsights {
  stock_symbol: string;
  current_weights: Record<string, number>;
  weight_history: EnsembleWeights[];
  prediction_breakdown: PredictionBreakdown[];
  contributions: ModelContribution[];
  individual_metrics?: Record<string, IndividualModelMetrics>;
  ensemble_metrics?: IndividualModelMetrics;
}
