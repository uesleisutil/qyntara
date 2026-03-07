# Dashboard Chart Components

This directory contains 7 interactive React chart components for the Model Optimization Dashboard, built with React 18, Recharts 2.12, and TailwindCSS.

## Components

### 1. MAPETimeSeriesChart

Multi-line chart showing MAPE evolution over time for ensemble and individual models.

**Features:**
- Multi-line comparison (ensemble vs individual models)
- Confidence bands (95% CI)
- Interactive tooltips with detailed metrics
- Threshold line at 7% target
- Click legend to toggle models

**Props:**
```javascript
{
  data: Array<{
    date: string,
    ensemble: number,
    deepar: number,
    lstm: number,
    prophet: number,
    xgboost: number,
    ensemble_upper?: number,
    ensemble_lower?: number
  }>,
  selectedModels?: string[], // Default: ['ensemble', 'deepar', 'lstm', 'prophet', 'xgboost']
  showConfidenceBands?: boolean, // Default: false
  onModelClick?: (model: string) => void
}
```

**Usage:**
```javascript
import { MAPETimeSeriesChart } from './components/charts';

<MAPETimeSeriesChart 
  data={mapeHistory}
  selectedModels={['ensemble', 'lstm']}
  showConfidenceBands={true}
  onModelClick={(model) => console.log('Clicked:', model)}
/>
```

---

### 2. ModelComparisonChart

Radar chart comparing 4 models across multiple metrics.

**Features:**
- Compares DeepAR, LSTM, Prophet, XGBoost
- Metrics: MAPE, Coverage, Interval Width, Training Time, Inference Speed
- Interactive highlighting on hover
- Click model to highlight

**Props:**
```javascript
{
  data: Array<{
    metric: string,
    deepar: number,
    lstm: number,
    prophet: number,
    xgboost: number
  }>,
  highlightedModel?: string,
  onModelClick?: (model: string) => void
}
```

**Usage:**
```javascript
import { ModelComparisonChart } from './components/charts';

<ModelComparisonChart 
  data={modelMetrics}
  highlightedModel="lstm"
  onModelClick={(model) => console.log('Clicked:', model)}
/>
```

---

### 3. FeatureImportanceChart

Horizontal bar chart showing SHAP feature importance values.

**Features:**
- Horizontal bars for better feature name readability
- Color-coded by feature category (technical, volume, lag, rolling, volatility)
- Interactive tooltips with SHAP values
- Click bar to see feature distribution

**Props:**
```javascript
{
  shapValues: Array<{
    feature: string,
    importance: number,
    category: string, // 'technical' | 'volume' | 'lag' | 'rolling' | 'volatility' | 'other'
    description?: string
  }>,
  topN?: number, // Default: 20
  onFeatureClick?: (feature: string) => void
}
```

**Usage:**
```javascript
import { FeatureImportanceChart } from './components/charts';

<FeatureImportanceChart 
  shapValues={shapData}
  topN={15}
  onFeatureClick={(feature) => console.log('Clicked:', feature)}
/>
```

---

### 4. DriftDetectionChart

Heatmap showing KS test p-values for feature drift detection.

**Features:**
- Heatmap visualization using scatter plot
- Color-coded by drift status (red = drift, green = no drift)
- Shows KS test p-values over time
- Interactive tooltips with p-value details
- Click cell to see feature distribution comparison

**Props:**
```javascript
{
  driftData: Array<{
    date: string,
    feature: string,
    pValue: number,
    ksStatistic?: number,
    driftDetected?: boolean
  }>,
  threshold?: number, // Default: 0.05
  onCellClick?: (feature: string, date: string) => void
}
```

**Usage:**
```javascript
import { DriftDetectionChart } from './components/charts';

<DriftDetectionChart 
  driftData={driftResults}
  threshold={0.05}
  onCellClick={(feature, date) => console.log('Clicked:', feature, date)}
/>
```

---

### 5. PredictionIntervalChart

Fan chart showing prediction intervals with actual values.

**Features:**
- Shows 50%, 80%, 95% confidence intervals as layered areas
- Point forecast line
- Actual values with markers
- Interactive tooltips showing coverage
- Hover to see if actual falls within intervals

**Props:**
```javascript
{
  predictions: Array<{
    date: string,
    forecast: number,
    lower_50?: number,
    upper_50?: number,
    lower_80?: number,
    upper_80?: number,
    lower_95?: number,
    upper_95?: number
  }>,
  actuals?: Array<{
    date: string,
    value: number
  }>,
  showIntervals?: {
    p50?: boolean,
    p80?: boolean,
    p95?: boolean
  } // Default: { p50: true, p80: true, p95: true }
}
```

**Usage:**
```javascript
import { PredictionIntervalChart } from './components/charts';

<PredictionIntervalChart 
  predictions={forecastData}
  actuals={actualData}
  showIntervals={{ p50: false, p80: true, p95: true }}
/>
```

---

### 6. EnsembleWeightsChart

Stacked area chart showing ensemble weight evolution over time.

**Features:**
- Stacked areas showing weight changes
- Weights always sum to 1.0 (100%)
- Interactive tooltips with weight details
- Click to see weight calculation details

**Props:**
```javascript
{
  weights: Array<{
    date: string,
    deepar: number,
    lstm: number,
    prophet: number,
    xgboost: number
  }>,
  onDateClick?: (date: string) => void
}
```

**Usage:**
```javascript
import { EnsembleWeightsChart } from './components/charts';

<EnsembleWeightsChart 
  weights={weightHistory}
  onDateClick={(date) => console.log('Clicked:', date)}
/>
```

---

### 7. StockRankingChart

Bump chart showing stock ranking changes over time.

**Features:**
- Shows top 20 stocks by MAPE ranking
- Lines show ranking evolution
- Interactive tooltips with stock details
- Click stock to see detailed metrics
- Hover to highlight specific stock
- Color-coded with consistent colors

**Props:**
```javascript
{
  rankings: Array<{
    date: string,
    [stockSymbol: string]: number // Rank value
  }>,
  topN?: number, // Default: 20
  onStockClick?: (stock: string) => void
}
```

**Usage:**
```javascript
import { StockRankingChart } from './components/charts';

<StockRankingChart 
  rankings={rankingData}
  topN={15}
  onStockClick={(stock) => console.log('Clicked:', stock)}
/>
```

---

## Common Features

All charts include:
- **Responsive design**: Automatically adjusts to container width
- **Interactive tooltips**: Hover for detailed information
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **TailwindCSS styling**: Consistent with dashboard theme
- **PropTypes validation**: Runtime type checking
- **Click handlers**: Optional callbacks for interactivity

## Color Scheme

### Model Colors
- **Ensemble**: `#8884d8` (Blue)
- **DeepAR**: `#82ca9d` (Green)
- **LSTM**: `#ffc658` (Yellow)
- **Prophet**: `#ff7c7c` (Red)
- **XGBoost**: `#a28fd0` (Purple)

### Feature Category Colors
- **Technical**: `#8884d8` (Blue)
- **Volume**: `#82ca9d` (Green)
- **Lag**: `#ffc658` (Yellow)
- **Rolling**: `#ff7c7c` (Red)
- **Volatility**: `#a28fd0` (Purple)
- **Other**: `#999999` (Gray)

### Drift Status Colors
- **No Drift**: `#44ff44` (Green)
- **Warning**: `#ffaa44` (Orange)
- **Drift Detected**: `#ff4444` (Red)

## Testing

All components have comprehensive test coverage:

```bash
npm test -- --testPathPattern="charts"
```

Test files are co-located with components:
- `MAPETimeSeriesChart.test.js`
- `ModelComparisonChart.test.js`
- `FeatureImportanceChart.test.js`
- `DriftDetectionChart.test.js`
- `PredictionIntervalChart.test.js`
- `EnsembleWeightsChart.test.js`
- `StockRankingChart.test.js`

## Dependencies

- **React**: ^18.2.0
- **Recharts**: ^2.12.7
- **PropTypes**: Included with React
- **TailwindCSS**: For tooltip styling

## Integration Example

```javascript
import React from 'react';
import {
  MAPETimeSeriesChart,
  ModelComparisonChart,
  FeatureImportanceChart,
  DriftDetectionChart,
  PredictionIntervalChart,
  EnsembleWeightsChart,
  StockRankingChart
} from './components/charts';

const Dashboard = () => {
  return (
    <div className="dashboard">
      <div className="chart-section">
        <h2>Model Performance</h2>
        <MAPETimeSeriesChart data={mapeData} />
        <ModelComparisonChart data={comparisonData} />
      </div>
      
      <div className="chart-section">
        <h2>Feature Analysis</h2>
        <FeatureImportanceChart shapValues={shapData} />
      </div>
      
      <div className="chart-section">
        <h2>Drift Monitoring</h2>
        <DriftDetectionChart driftData={driftData} />
      </div>
      
      <div className="chart-section">
        <h2>Predictions</h2>
        <PredictionIntervalChart 
          predictions={predictions} 
          actuals={actuals} 
        />
      </div>
      
      <div className="chart-section">
        <h2>Ensemble Insights</h2>
        <EnsembleWeightsChart weights={weights} />
      </div>
      
      <div className="chart-section">
        <h2>Stock Rankings</h2>
        <StockRankingChart rankings={rankings} />
      </div>
    </div>
  );
};

export default Dashboard;
```

## Notes

- All charts use `ResponsiveContainer` from Recharts for automatic sizing
- Tooltips are styled with TailwindCSS classes
- Charts handle empty data gracefully
- All numeric values are formatted appropriately (percentages, currency, etc.)
- Click handlers are optional and can be omitted if not needed
