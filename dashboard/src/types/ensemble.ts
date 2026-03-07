/**
 * Type definitions for ensemble insights
 */

export interface EnsembleWeights {
  date: string;
  deepar: number;
  lstm: number;
  prophet: number;
  xgboost: number;
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

export interface EnsembleInsights {
  stock_symbol: string;
  current_weights: Record<string, number>;
  weight_history: EnsembleWeights[];
  prediction_breakdown: PredictionBreakdown[];
  contributions: ModelContribution[];
}
