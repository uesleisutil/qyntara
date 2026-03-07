# Dashboard Panel Components

This directory contains the main panel components for the Model Optimization Dashboard. Each panel provides a comprehensive view of different aspects of the ML forecasting system.

## Components

### 1. ModelPerformancePanel

**Purpose**: Display overall model performance metrics and comparisons

**Features**:
- Metric cards showing MAPE, coverage, interval width, and top performers
- Trend indicators for each metric
- MAPE time series chart with confidence bands
- Model comparison radar chart
- Stock and date range filters

**Props**:
- `data`: Performance metrics data object
- `selectedStock`: Currently selected stock symbol
- `dateRange`: Date range object with start and end dates
- `onStockChange`: Callback for stock selection changes
- `onDateRangeChange`: Callback for date range changes

**Requirements**: 13.1, 13.2, 13.3

---

### 2. EnsembleInsightsPanel

**Purpose**: Display ensemble model insights and contribution breakdown

**Features**:
- Current ensemble weights display
- Weight evolution over time (stacked area chart)
- Model contributions pie chart
- Prediction breakdown table showing individual model contributions
- Stock selector filter

**Props**:
- `data`: Ensemble insights data object
- `selectedStock`: Currently selected stock symbol
- `onStockChange`: Callback for stock selection changes

**Requirements**: 13.3

---

### 3. FeatureAnalysisPanel

**Purpose**: Display feature importance and analysis using SHAP values

**Features**:
- Tabbed interface for different views:
  - Feature Importance: SHAP values bar chart
  - Distributions: Feature value distributions over time
  - Correlations: Feature correlation heatmap
- Stock selector filter
- Interactive visualizations

**Props**:
- `data`: Feature analysis data object
- `selectedStock`: Currently selected stock symbol
- `onStockChange`: Callback for stock selection changes

**Requirements**: 13.3, 15.3

---

### 4. DriftMonitoringPanel

**Purpose**: Monitor and display model and feature drift

**Features**:
- Drift summary with status badges
- Performance drift chart (current vs baseline MAPE)
- Feature drift heatmap using KS test p-values
- Drift events timeline
- Alerts-only toggle filter
- Manual refresh button

**Props**:
- `data`: Drift monitoring data object
- `onRefresh`: Callback for manual refresh

**Requirements**: 13.3

---

### 5. ExplainabilityPanel

**Purpose**: Provide prediction explainability using SHAP analysis

**Features**:
- Recent predictions selector
- SHAP waterfall chart showing feature contributions
- Feature values table with impact direction
- Dominant model identification
- Confidence indicators
- Stock selector filter

**Props**:
- `data`: Explainability data object
- `selectedStock`: Currently selected stock symbol
- `onStockChange`: Callback for stock selection changes

**Requirements**: 13.3, 13.5, 15.1, 15.2

---

### 6. HyperparameterPanel

**Purpose**: Display hyperparameter optimization history and progress

**Features**:
- Model selector to view different model hyperparameters
- Current best parameters display
- Optimization progress scatter plot
- Parameter history line charts
- Top 5 best trials table
- Optimization statistics

**Props**:
- `data`: Hyperparameter data object (keyed by model type)
- `selectedModel`: Currently selected model
- `onModelChange`: Callback for model selection changes

**Requirements**: 13.3

---

## Usage Example

```jsx
import {
  ModelPerformancePanel,
  EnsembleInsightsPanel,
  FeatureAnalysisPanel,
  DriftMonitoringPanel,
  ExplainabilityPanel,
  HyperparameterPanel
} from './components/panels';

function Dashboard() {
  const [selectedStock, setSelectedStock] = useState('PETR4');
  const [dateRange, setDateRange] = useState({
    start: '2024-01-01',
    end: '2024-12-31'
  });

  return (
    <div className="space-y-6">
      <ModelPerformancePanel
        data={performanceData}
        selectedStock={selectedStock}
        dateRange={dateRange}
        onStockChange={setSelectedStock}
        onDateRangeChange={setDateRange}
      />
      
      <EnsembleInsightsPanel
        data={ensembleData}
        selectedStock={selectedStock}
        onStockChange={setSelectedStock}
      />
      
      <FeatureAnalysisPanel
        data={featureData}
        selectedStock={selectedStock}
        onStockChange={setSelectedStock}
      />
      
      <DriftMonitoringPanel
        data={driftData}
        onRefresh={handleRefresh}
      />
      
      <ExplainabilityPanel
        data={explainabilityData}
        selectedStock={selectedStock}
        onStockChange={setSelectedStock}
      />
      
      <HyperparameterPanel
        data={hyperparameterData}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />
    </div>
  );
}
```

## Data Structure

### ModelPerformancePanel Data
```javascript
{
  ensemble_mape: 6.5,
  coverage: 91.2,
  interval_width: 12.3,
  top_performers_count: 35,
  mape_trend: 'improving',
  coverage_trend: 'stable',
  interval_trend: 'improving',
  performers_trend: 'up',
  mape_history: [
    { date: '2024-01-01', ensemble: 6.8, deepar: 7.2, lstm: 6.5, prophet: 7.5, xgboost: 6.3 }
  ],
  model_comparison: [
    { metric: 'MAPE', deepar: 7.2, lstm: 6.5, prophet: 7.5, xgboost: 6.3 }
  ]
}
```

### EnsembleInsightsPanel Data
```javascript
{
  current_weights: { deepar: 0.25, lstm: 0.30, prophet: 0.20, xgboost: 0.25 },
  weight_history: [
    { date: '2024-01-01', deepar: 0.25, lstm: 0.30, prophet: 0.20, xgboost: 0.25 }
  ],
  contributions: { deepar: 0.25, lstm: 0.30, prophet: 0.20, xgboost: 0.25 },
  prediction_breakdown: [
    { model: 'deepar', prediction: 30.5, weight: 0.25, contribution: 7.625 }
  ]
}
```

### FeatureAnalysisPanel Data
```javascript
{
  shap_values: [
    { feature: 'rsi_14', importance: 0.15, category: 'technical' }
  ],
  top_features: [
    {
      name: 'rsi_14',
      category: 'technical',
      avg_value: 0.523,
      distribution: [{ date: '2024-01-01', value: 0.52 }]
    }
  ],
  correlation_matrix: [
    { feature1: 'rsi_14', feature2: 'macd', correlation: 0.65 }
  ]
}
```

### DriftMonitoringPanel Data
```javascript
{
  performance_drift: false,
  feature_drift_count: 2,
  baseline_mape: 6.5,
  current_mape: 6.8,
  mape_change_percentage: 4.6,
  mape_history: [
    { date: '2024-01-01', current: 6.8, baseline: 6.5 }
  ],
  all_features: [
    { feature: 'rsi_14', date: '2024-01-01', pValue: 0.03, driftDetected: true }
  ],
  drifted_features: [
    { feature: 'rsi_14', date: '2024-01-01', pValue: 0.03, driftDetected: true }
  ],
  drift_events: [
    {
      date: '2024-01-15',
      type: 'feature_drift',
      description: 'RSI feature drift detected',
      severity: 'warning'
    }
  ]
}
```

### ExplainabilityPanel Data
```javascript
{
  recent_predictions: [
    {
      id: 'pred-1',
      prediction_date: '2024-01-15',
      prediction_value: 30.5,
      confidence: 0.85,
      dominant_model: 'LSTM',
      base_value: 28.0,
      shap_waterfall: [
        { feature: 'rsi_14', value: 0.52, shap_value: 0.15 }
      ],
      top_features: [
        { name: 'rsi_14', value: 0.52, shap_value: 0.15 }
      ]
    }
  ]
}
```

### HyperparameterPanel Data
```javascript
{
  lstm: {
    best_params: { hidden_size: 128, num_layers: 3, dropout: 0.2 },
    best_mape: 6.5,
    optimization_progress: [
      { trial_number: 1, mape: 7.2, params: { hidden_size: 64 } }
    ],
    optimization_stats: {
      total_trials: 50,
      completed_trials: 50,
      optimization_time_hours: 18.5
    },
    param_history: [
      { date: '2024-01-01', params: { hidden_size: 128 } }
    ],
    best_trials: [
      { trial_number: 15, mape: 6.5, params: { hidden_size: 128 } }
    ]
  }
}
```

## Dependencies

All panels use:
- React 18
- Recharts for visualizations
- Lucide React for icons
- TailwindCSS for styling
- PropTypes for type checking

## Integration with Chart Components

Panels integrate the following chart components from `../charts/`:
- `MAPETimeSeriesChart`
- `ModelComparisonChart`
- `FeatureImportanceChart`
- `DriftDetectionChart`
- `EnsembleWeightsChart`

## Integration with Filter Components

Panels use the following filter components from `../filters/`:
- `StockSelector`
- `DateRangePicker`
- `ModelSelector`

## Styling

All panels follow a consistent design pattern:
- White background with rounded corners and shadow
- Blue accent color (#3b82f6)
- Responsive grid layouts
- Consistent spacing and typography
- Accessible color contrasts

## Accessibility

- Semantic HTML structure
- ARIA labels where appropriate
- Keyboard navigation support
- Color-blind friendly color schemes
- Sufficient color contrast ratios

## Testing

Each panel component should be tested for:
- Proper rendering with valid data
- Loading state handling
- Empty state handling
- User interaction callbacks
- Responsive layout behavior

## Future Enhancements

- Add export functionality for charts
- Implement real-time data updates
- Add customizable thresholds
- Support for multiple stock comparison
- Advanced filtering options
