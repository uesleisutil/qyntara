# Validation Tab Components

This directory contains the 5 core components for the Validation tab enhancement (Task 5).

## Components

### 1. ScatterPlotChart
**File:** `ScatterPlotChart.tsx`

Displays predicted vs actual returns as a scatter plot with:
- Diagonal reference line for perfect predictions
- Color-coded points by error magnitude (green/yellow/orange/red)
- Correlation coefficient and R-squared display
- Interactive tooltips with ticker details

**Requirements:** 11.1-11.8

### 2. TemporalAccuracyChart
**File:** `TemporalAccuracyChart.tsx`

Shows accuracy metrics over time with:
- Time series for accuracy, MAPE, and correlation
- Granularity selector (daily/weekly/monthly)
- Trend lines for each metric
- Threshold highlighting for periods below 50% accuracy

**Requirements:** 12.1-12.8

### 3. SegmentationChart
**File:** `SegmentationChart.tsx`

Displays performance by return ranges with:
- Grouped bar chart for accuracy, MAPE, and count
- Custom range boundary configuration
- Highlighting of segments with accuracy < 50%
- Summary statistics

**Requirements:** 13.1-13.8

### 4. OutlierTable
**File:** `OutlierTable.tsx`

Analyzes prediction outliers with:
- Table of outliers (errors > 3 std devs)
- Grouping by over/under-prediction
- Common characteristics analysis
- Click handlers for detailed views

**Requirements:** 14.1-14.8

### 5. BacktestSimulator
**File:** `BacktestSimulator.tsx`

Portfolio backtesting interface with:
- Configuration panel for parameters
- Cumulative portfolio value chart
- Performance metrics display
- Drawdown analysis
- Portfolio composition tracking

**Requirements:** 15.1-15.10

## Usage

```typescript
import {
  ScatterPlotChart,
  TemporalAccuracyChart,
  SegmentationChart,
  OutlierTable,
  BacktestSimulator,
} from './components/validation';

// See ValidationPage.tsx for complete example
```

## Testing

Run tests with:
```bash
npm test -- ScatterPlotChart.test.tsx
```

## Stack

- React 18 + TypeScript
- Recharts for charts
- TanStack Table for tables (OutlierTable)
- Jest + React Testing Library for tests
