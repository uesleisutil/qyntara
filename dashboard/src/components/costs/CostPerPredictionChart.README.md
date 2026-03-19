# CostPerPredictionChart Component

## Overview

The `CostPerPredictionChart` component displays cost per prediction metrics with comprehensive trend analysis and threshold monitoring. It visualizes unit economics for the ML prediction system.

## Requirements

Implements requirements 17.1-17.8:
- 17.1: Calculate cost per prediction
- 17.2: Divide total daily costs by number of predictions
- 17.3: Display as time series chart
- 17.4: Calculate average cost per prediction
- 17.5: Display trend (increasing/stable/decreasing)
- 17.6: Highlight days exceeding target thresholds
- 17.7: Segment by model type
- 17.8: Display efficiency improvements over time

## Features

- **Time Series Visualization**: Line chart showing cost per prediction over time
- **Trend Analysis**: Automatic trend detection (increasing/stable/decreasing) using linear regression
- **Threshold Monitoring**: Highlights days where costs exceed target thresholds
- **Model Segmentation**: Optional breakdown by model type (LSTM, RandomForest, XGBoost, etc.)
- **Efficiency Tracking**: Compares first week vs last week to show improvements
- **Statistics Summary**: Displays average, min, max, and target threshold
- **Responsive Design**: Adapts to different screen sizes
- **Theme Support**: Works with light and dark themes

## Usage

### Basic Usage

```tsx
import { CostPerPredictionChart } from '../components/costs';
import { useCosts } from '../hooks/useCosts';

function CostsTab() {
  const { data, isLoading } = useCosts({ days: 30 });

  return (
    <div>
      <CostPerPredictionChart 
        data={data} 
        isLoading={isLoading}
      />
    </div>
  );
}
```

### With Model Segmentation

```tsx
<CostPerPredictionChart 
  data={data} 
  isLoading={isLoading}
  showModelSegmentation={true}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `CostPerPredictionData \| null` | - | Cost per prediction data from API |
| `isLoading` | `boolean` | `false` | Loading state indicator |
| `showModelSegmentation` | `boolean` | `false` | Whether to show breakdown by model type |

## Data Structure

The component expects data in the following format:

```typescript
interface CostPerPredictionData {
  cost_per_prediction: {
    daily_metrics: Array<{
      date: string;                    // ISO date string
      totalCost: number;               // Total cost for the day
      predictionCount: number;         // Number of predictions made
      costPerPrediction: number;       // Calculated cost per prediction
      modelBreakdown?: {               // Optional model-level breakdown
        [modelType: string]: {
          cost: number;
          predictions: number;
          costPerPrediction: number;
        };
      };
    }>;
    target_threshold?: number;         // Target cost per prediction (default: 0.10)
  };
}
```

## Example Data

```json
{
  "cost_per_prediction": {
    "daily_metrics": [
      {
        "date": "2024-01-01",
        "totalCost": 10.0,
        "predictionCount": 100,
        "costPerPrediction": 0.10,
        "modelBreakdown": {
          "LSTM": {
            "cost": 4.0,
            "predictions": 40,
            "costPerPrediction": 0.10
          },
          "RandomForest": {
            "cost": 3.0,
            "predictions": 30,
            "costPerPrediction": 0.10
          },
          "XGBoost": {
            "cost": 3.0,
            "predictions": 30,
            "costPerPrediction": 0.10
          }
        }
      }
    ],
    "target_threshold": 0.10
  }
}
```

## Visual Elements

### Main Chart
- Line chart showing cost per prediction over time
- Reference line indicating target threshold
- Dots marking days that exceed threshold
- Optional model-specific lines when segmentation is enabled

### Statistics Panel
- **Custo Médio**: Average cost per prediction
- **Custo Mínimo**: Minimum cost observed
- **Custo Máximo**: Maximum cost observed
- **Limite Alvo**: Target threshold value

### Trend Indicator
- **Aumentando** (↗): Costs are increasing over time
- **Estável** (→): Costs are stable
- **Diminuindo** (↘): Costs are decreasing over time

### Efficiency Improvement Panel
Shows comparison between first week and last week:
- First week average
- Last week average
- Percentage improvement (positive = cost reduction)

### Threshold Exceeded Panel
Lists days where cost per prediction exceeded the target threshold (up to 5 days shown)

## Trend Calculation

The component uses linear regression to calculate the trend:
1. Calculates slope of cost per prediction over time
2. Compares slope against 5% threshold
3. Classifies as increasing, stable, or decreasing

## Efficiency Calculation

Efficiency improvement is calculated as:
```
improvement = ((firstWeekAvg - lastWeekAvg) / firstWeekAvg) * 100
```

Positive values indicate cost reduction (improvement).

## Styling

The component uses theme-aware colors from `useChartColors()`:
- Primary: Main line color
- Success: Decreasing trend, minimum values
- Error: Increasing trend, threshold exceeded, maximum values
- Warning: Target threshold
- Neutral: Stable trend

## Accessibility

- Semantic HTML structure
- Color-coded indicators with text labels
- Tooltips for detailed information
- Responsive font sizes

## Testing

Comprehensive test coverage includes:
- All 8 requirements (17.1-17.8)
- Loading and error states
- Trend calculation accuracy
- Threshold detection
- Model segmentation
- Edge cases (empty data, single data point, etc.)

Run tests:
```bash
npm test -- CostPerPredictionChart.test.tsx
```

## Integration with Backend

The component expects data from the `/api/monitoring/costs` endpoint. The backend should:
1. Calculate daily total costs from AWS Cost Explorer
2. Count daily predictions from system logs
3. Compute cost per prediction (total cost / prediction count)
4. Optionally provide model-level breakdown
5. Return data in the expected format

## Performance Considerations

- Uses `useMemo` for expensive calculations
- Efficient trend calculation (O(n) complexity)
- Recharts handles chart rendering optimization
- Minimal re-renders with proper prop dependencies

## Future Enhancements

Potential improvements:
- Export chart as image/PDF
- Configurable threshold via UI
- Drill-down to hourly granularity
- Cost prediction/forecasting
- Anomaly detection alerts
- Comparison with historical periods
