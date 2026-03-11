/**
 * Custom Hooks Index
 * 
 * Exports all custom hooks for the dashboard.
 */

export { useMetrics } from './useMetrics';
export { usePredictions, useModelComparison } from './usePredictions';
export { useModels, useHyperparameterHistory } from './useModels';
export { useDrift } from './useDrift';
export { useExplainability, useFeatureImportance, usePredictionExplainability } from './useExplainability';

// New Dashboard API hooks
export { useRecommendations } from './useRecommendations';
export { useDataQuality } from './useDataQuality';
export { useModelPerformance } from './useModelPerformance';
export { useCosts } from './useCosts';
export { useEnsembleWeights } from './useEnsembleWeights';
