# Performance Tab Components

This document describes the 6 new Performance Tab components implemented for the B3 Tactical Ranking Dashboard.

## Components Overview

### 1. ModelBreakdownTable

**Purpose**: Display individual model performance metrics in a sortable table format.

**Features**:
- Displays MAPE, Accuracy, and Sharpe Ratio for each model
- Sortable columns (click header to sort)
- Highlights best performing model for each metric with a star (★)
- Color-coded best metrics with green background
- Responsive design with dark mode support

**Props**:
```typescript
interface ModelBreakdownTableProps {
  data: ModelPerformance[];
  loading?: boolean;
  error?: Error;
  height?: number;
}

interface ModelPerformance {
  modelId: string;
  modelName: string;
  mape: number;
  accuracy: number;
  sharpeRatio: number;
  correlation?: number;
}
```

**Usage**:
```tsx
<ModelBreakdownTable 
  data={modelPerformanceData}
  height={400}
/>
```

---

### 2. ConfusionMatrixChart

**Purpose**: Visualize directional prediction accuracy using a confusion matrix.

**Features**:
- 3x3 matrix for up/down/neutral predictions vs actuals
- Color intensity based on percentage of predictions
- Displays both counts and percentages in cells
- Shows precision and recall metrics
- Highlights strong correlations with orange borders (|r| > 0.7)
- Interactive tooltips
- Built with D3.js for custom visualization

**Props**:
```typescript
interface ConfusionMatrixChartProps {
  data: ConfusionMatrixData;
  loading?: boolean;
  error?: Error;
  height?: number;
  width?: number;
}

interface ConfusionMatrixData {
  predicted: {
    up: { actual: { up: number; down: number; neutral: number } };
    down: { actual: { up: number; down: number; neutral: number } };
    neutral: { actual: { up: number; down: number; neutral: number } };
  };
  precision: { up: number; down: number; neutral: number };
  recall: { up: number; down: number; neutral: number };
}
```

**Usage**:
```tsx
<ConfusionMatrixChart 
  data={confusionMatrixData}
  height={500}
/>
```

---

### 3. ErrorDistributionChart

**Purpose**: Display histogram of prediction errors with normal distribution overlay.

**Features**:
- Groups errors into 1% bins
- Highlights outlier bins (> 3 standard deviations) in red
- Displays mean and standard deviation in description
- Interactive tooltips showing count and percentage
- Click handler for viewing constituent predictions
- Reference line at zero error
- Built with Recharts

**Props**:
```typescript
interface ErrorDistributionChartProps {
  data: ErrorDistributionData;
  loading?: boolean;
  error?: Error;
  height?: number;
  onBinClick?: (bin: { min: number; max: number; count: number }) => void;
}

interface ErrorDistributionData {
  bins: { min: number; max: number; count: number; percentage: number }[];
  mean: number;
  stdDev: number;
  outliers: PredictionError[];
}
```

**Usage**:
```tsx
<ErrorDistributionChart 
  data={errorDistributionData}
  onBinClick={(bin) => console.log('Clicked bin:', bin)}
/>
```

---

### 4. BenchmarkComparisonChart

**Purpose**: Compare model performance against market benchmarks.

**Features**:
- Two views: Cumulative Returns (line chart) and Metrics Comparison (table)
- Compares model vs Ibovespa, Moving Average, and CDI
- Displays alpha (outperformance) prominently
- Interactive view toggle
- Shows total return, Sharpe ratio, max drawdown, and volatility
- Built with Recharts

**Props**:
```typescript
interface BenchmarkComparisonChartProps {
  data: BenchmarkData;
  timeSeriesData?: TimeSeriesPoint[];
  loading?: boolean;
  error?: Error;
  height?: number;
}

interface BenchmarkData {
  model: PerformanceMetrics;
  ibovespa: PerformanceMetrics;
  movingAverage: PerformanceMetrics;
  cdi?: PerformanceMetrics;
}
```

**Usage**:
```tsx
<BenchmarkComparisonChart 
  data={benchmarkData}
  timeSeriesData={cumulativeReturnsData}
  height={500}
/>
```

---

### 5. FeatureImportanceChartEnhanced

**Purpose**: Visualize feature importance for selected model.

**Features**:
- Model selector dropdown
- Horizontal bar chart showing top N features (default 20)
- Features displayed as percentages
- Color gradient for visual distinction
- Interactive tooltips with feature descriptions
- Built with Recharts

**Props**:
```typescript
interface FeatureImportanceChartEnhancedProps {
  data: ModelFeatureImportance[];
  loading?: boolean;
  error?: Error;
  height?: number;
  topN?: number;
}

interface ModelFeatureImportance {
  modelId: string;
  modelName: string;
  features: FeatureImportance[];
}

interface FeatureImportance {
  feature: string;
  importance: number;
  description?: string;
}
```

**Usage**:
```tsx
<FeatureImportanceChartEnhanced 
  data={featureImportanceData}
  topN={20}
  height={500}
/>
```

---

### 6. CorrelationHeatmap

**Purpose**: Display Pearson correlation matrix between features.

**Features**:
- Color gradient from red (-1) to white (0) to blue (+1)
- Highlights strong correlations (|r| > 0.7) with orange borders
- Displays correlation values in cells (for larger cells)
- Interactive tooltips
- Click handler for viewing scatter plots
- Color legend
- Built with D3.js for custom visualization

**Props**:
```typescript
interface CorrelationHeatmapProps {
  data: CorrelationData;
  loading?: boolean;
  error?: Error;
  height?: number;
  width?: number;
  onCellClick?: (feature1: string, feature2: string, correlation: number) => void;
}

interface CorrelationData {
  features: string[];
  correlations: number[][];
}
```

**Usage**:
```tsx
<CorrelationHeatmap 
  data={correlationData}
  onCellClick={(f1, f2, corr) => console.log(`${f1} vs ${f2}: ${corr}`)}
  height={600}
/>
```

---

## Common Features

All components:
- Extend `BaseChart` for consistent loading and error states
- Support dark mode via CSS media queries
- Responsive design
- TypeScript typed with full IntelliSense support
- Accessible with ARIA labels and keyboard navigation
- Consistent styling and theming

## Dependencies

- **Recharts**: Standard charts (bar, line, area)
- **D3.js**: Custom visualizations (confusion matrix, heatmap)
- **React**: Component framework
- **TypeScript**: Type safety

## File Structure

```
dashboard/src/components/charts/
├── ModelBreakdownTable.tsx
├── ConfusionMatrixChart.tsx
├── ErrorDistributionChart.tsx
├── BenchmarkComparisonChart.tsx
├── FeatureImportanceChartEnhanced.tsx
├── CorrelationHeatmap.tsx
├── PerformanceTabExample.tsx (usage examples)
├── PERFORMANCE_COMPONENTS.md (this file)
└── index.ts (exports)
```

## Testing

Each component should be tested for:
- Correct rendering with valid data
- Loading state display
- Error state display
- Interactive features (sorting, clicking, hovering)
- Responsive behavior
- Dark mode styling
- Accessibility (keyboard navigation, screen readers)

## Requirements Mapping

These components fulfill the following requirements from the spec:

- **Requirement 6**: Individual Model Performance Breakdown (ModelBreakdownTable)
- **Requirement 7**: Directional Prediction Confusion Matrix (ConfusionMatrixChart)
- **Requirement 8**: Error Distribution Analysis (ErrorDistributionChart)
- **Requirement 9**: Benchmark Comparison (BenchmarkComparisonChart)
- **Requirement 10**: Feature Importance Visualization (FeatureImportanceChartEnhanced)
- **Requirement 53**: Correlation Heatmap (CorrelationHeatmap)

## Next Steps

1. Integrate components into Performance Tab
2. Connect to data sources via API hooks
3. Add unit tests for each component
4. Add property-based tests for data transformations
5. Implement remaining Performance Tab features
