/**
 * Example usage of Performance Tab components
 * This file demonstrates how to use the 6 new Performance Tab components
 */

import React from 'react';
import {
  ModelBreakdownTable,
  ConfusionMatrixChart,
  ErrorDistributionChart,
  BenchmarkComparisonChart,
  FeatureImportanceChartEnhanced,
  CorrelationHeatmap,
} from './index';

// Example data structures
const exampleModelPerformance = [
  { modelId: 'lstm', modelName: 'LSTM', mape: 12.5, accuracy: 65.2, sharpeRatio: 1.45 },
  { modelId: 'xgboost', modelName: 'XGBoost', mape: 11.8, accuracy: 67.8, sharpeRatio: 1.52 },
  { modelId: 'prophet', modelName: 'Prophet', mape: 13.2, accuracy: 63.5, sharpeRatio: 1.38 },
  { modelId: 'deepar', modelName: 'DeepAR', mape: 12.1, accuracy: 66.1, sharpeRatio: 1.48 },
];

const exampleConfusionMatrix = {
  predicted: {
    up: { actual: { up: 120, down: 15, neutral: 10 } },
    down: { actual: { up: 10, down: 95, neutral: 8 } },
    neutral: { actual: { up: 20, down: 12, neutral: 110 } },
  },
  precision: { up: 0.80, down: 0.78, neutral: 0.86 },
  recall: { up: 0.83, down: 0.84, neutral: 0.77 },
};

const exampleErrorDistribution = {
  bins: [
    { min: -15, max: -10, count: 5, percentage: 2.5 },
    { min: -10, max: -5, count: 15, percentage: 7.5 },
    { min: -5, max: 0, count: 80, percentage: 40 },
    { min: 0, max: 5, count: 85, percentage: 42.5 },
    { min: 5, max: 10, count: 12, percentage: 6 },
    { min: 10, max: 15, count: 3, percentage: 1.5 },
  ],
  mean: 0.5,
  stdDev: 3.2,
  outliers: [],
};

const exampleBenchmarkData = {
  model: {
    totalReturn: 25.5,
    annualizedReturn: 18.2,
    volatility: 15.3,
    sharpeRatio: 1.19,
    sortinoRatio: 1.45,
    maxDrawdown: -12.5,
    alpha: 8.3,
  },
  ibovespa: {
    totalReturn: 17.2,
    annualizedReturn: 12.5,
    volatility: 18.5,
    sharpeRatio: 0.68,
    sortinoRatio: 0.85,
    maxDrawdown: -18.2,
  },
  movingAverage: {
    totalReturn: 20.1,
    annualizedReturn: 14.8,
    volatility: 16.2,
    sharpeRatio: 0.91,
    sortinoRatio: 1.12,
    maxDrawdown: -14.8,
  },
};

const exampleFeatureImportance = [
  {
    modelId: 'xgboost',
    modelName: 'XGBoost',
    features: [
      { feature: 'RSI_14', importance: 0.15, description: 'Relative Strength Index' },
      { feature: 'MACD', importance: 0.12, description: 'Moving Average Convergence Divergence' },
      { feature: 'Volume_MA_20', importance: 0.10, description: '20-day volume moving average' },
      { feature: 'Price_MA_50', importance: 0.09, description: '50-day price moving average' },
      { feature: 'Bollinger_Upper', importance: 0.08 },
    ],
  },
];

const exampleCorrelationData = {
  features: ['RSI', 'MACD', 'Volume', 'Price_MA', 'Volatility'],
  correlations: [
    [1.0, 0.65, 0.12, 0.45, -0.23],
    [0.65, 1.0, 0.08, 0.52, -0.18],
    [0.12, 0.08, 1.0, 0.15, 0.35],
    [0.45, 0.52, 0.15, 1.0, -0.42],
    [-0.23, -0.18, 0.35, -0.42, 1.0],
  ],
};

export const PerformanceTabExample: React.FC = () => {
  return (
    <div className="performance-tab-example">
      <h1>Performance Tab Components</h1>

      <section>
        <h2>1. Model Breakdown Table</h2>
        <ModelBreakdownTable data={exampleModelPerformance} />
      </section>

      <section>
        <h2>2. Confusion Matrix Chart</h2>
        <ConfusionMatrixChart data={exampleConfusionMatrix} />
      </section>

      <section>
        <h2>3. Error Distribution Chart</h2>
        <ErrorDistributionChart
          data={exampleErrorDistribution}
          onBinClick={(bin) => console.log('Clicked bin:', bin)}
        />
      </section>

      <section>
        <h2>4. Benchmark Comparison Chart</h2>
        <BenchmarkComparisonChart data={exampleBenchmarkData} />
      </section>

      <section>
        <h2>5. Feature Importance Chart</h2>
        <FeatureImportanceChartEnhanced data={exampleFeatureImportance} />
      </section>

      <section>
        <h2>6. Correlation Heatmap</h2>
        <CorrelationHeatmap
          data={exampleCorrelationData}
          onCellClick={(f1, f2, corr) => console.log(`${f1} vs ${f2}: ${corr}`)}
        />
      </section>
    </div>
  );
};

export default PerformanceTabExample;
