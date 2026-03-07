/**
 * Type definitions for model explainability
 */

export interface ShapValue {
  feature: string;
  value: number;
  shap_value: number;
  category?: string;
}

export interface FeatureContribution {
  name: string;
  value: number;
  shap_value: number;
  category: string;
}

export interface ExplainabilityData {
  stock_symbol: string;
  prediction_date: string;
  prediction_value: number;
  confidence: number;
  dominant_model: string;
  base_value: number;
  shap_waterfall: ShapValue[];
  top_features: FeatureContribution[];
  feature_distributions: Record<string, Array<{ date: string; value: number }>>;
  model_contributions: Record<string, number>;
}

export interface PredictionDetails {
  id: string;
  stock_symbol: string;
  date: string;
  value: number;
  confidence: number;
  dominant_model: string;
  base_value: number;
  shap_waterfall: ShapValue[];
  top_features: FeatureContribution[];
}
