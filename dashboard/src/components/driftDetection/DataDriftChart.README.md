# DataDriftChart Component

## Overview

The `DataDriftChart` component implements data drift detection visualization for the B3 Tactical Ranking MLOps Dashboard. It displays feature distribution changes using Kolmogorov-Smirnov (KS) test statistics and provides interactive distribution comparison charts.

## Requirements Implemented

This component implements the following requirements from the specification:

- **25.1**: Display Drift Detection tab
- **25.2**: Calculate distribution statistics over rolling 30-day windows
- **25.3**: Compare current vs baseline distributions
- **25.4**: Calculate Kolmogorov-Smirnov test statistics
- **25.5**: Flag features with p-value < 0.05 as drifted
- **25.6**: Display list of drifted features with magnitude
- **25.7**: Visualize distribution changes with overlaid histograms
- **25.8**: Display drift results for past 90 days

## Features

### 1. Summary Card
- Displays count of drifted features vs total features
- Visual indicator (warning/success) based on drift status
- Explanation of drift detection threshold (p-value < 0.05)

### 2. Drifted Features Table
- Sortable columns: Feature name, KS Statistic, P-Value, Magnitude
- Click-to-sort functionality with visual indicators
- Severity badges (High/Moderate) based on p-value
- Interactive row selection to view distribution comparison
- Hover effects for better UX
- Empty state when no drift detected

### 3. Distribution Comparison Chart
- Overlaid histograms showing current vs baseline distributions
- Displays KS statistic, p-value, and drift magnitude
- Interactive Recharts visualization
- Interpretation text explaining the KS test
- Responsive design for mobile and desktop

## Props

```typescript
interface DataDriftChartProps {
  driftData: FeatureDriftData[];  // Array of feature drift data
  darkMode?: boolean;              // Enable dark mode styling
  isMobile?: boolean;              // Enable mobile-optimized layout
}

interface FeatureDriftData {
  feature: string;                 // Feature name
  ksStatistic: number;             // Kolmogorov-Smirnov test statistic
  pValue: number;                  // Statistical significance (0-1)
  drifted: boolean;                // Whether drift is detected (p < 0.05)
  magnitude: number;               // Drift magnitude score
  currentDistribution: number[];   // Current distribution histogram bins
  baselineDistribution: number[];  // Baseline distribution histogram bins
}
```

## Usage

```tsx
import { DataDriftChart } from './components/driftDetection/DataDriftChart';

function DriftDetectionTab() {
  const driftData = [
    {
      feature: 'price_momentum',
      ksStatistic: 0.234,
      pValue: 0.012,
      drifted: true,
      magnitude: 2.5,
      currentDistribution: [0.1, 0.2, 0.3, 0.25, 0.15],
      baselineDistribution: [0.15, 0.25, 0.3, 0.2, 0.1]
    },
    // ... more features
  ];

  return (
    <DataDriftChart 
      driftData={driftData}
      darkMode={false}
      isMobile={false}
    />
  );
}
```

## Data Flow

1. **Input**: Receives `driftData` array with feature drift statistics
2. **Filtering**: Filters to show only drifted features (p-value < 0.05)
3. **Sorting**: Allows user to sort by any column
4. **Selection**: User clicks a feature to view distribution comparison
5. **Visualization**: Displays overlaid histograms for selected feature

## Kolmogorov-Smirnov Test

The component uses the KS test to detect distribution drift:

- **KS Statistic**: Maximum distance between cumulative distribution functions (0-1)
- **P-Value**: Probability that distributions are the same (0-1)
- **Threshold**: p-value < 0.05 indicates significant drift
- **Severity**:
  - High: p-value < 0.01 (very significant drift)
  - Moderate: 0.01 ≤ p-value < 0.05 (significant drift)

## Styling

The component uses inline styles with theme-aware colors:

- **Light Mode**: White backgrounds, dark text
- **Dark Mode**: Dark backgrounds, light text
- **Responsive**: Adapts to mobile and desktop layouts
- **Interactive**: Hover effects, click feedback, sort indicators

## Testing

Comprehensive test suite covers:

- Rendering with various data states
- Feature filtering and sorting
- Interactive selection and deselection
- Empty states and edge cases
- Dark mode and mobile layouts
- Severity badge display

Run tests:
```bash
npm test -- DataDriftChart.test.tsx --watchAll=false
```

## Integration

The component is integrated into the `DriftDetectionTab`:

```tsx
<DataDriftChart 
  driftData={data.data_drift || []}
  darkMode={darkMode}
  isMobile={isMobile}
/>
```

## Dependencies

- **React**: Component framework
- **Recharts**: Chart visualization library
- **lucide-react**: Icon library
- **Card**: Shared card component

## Accessibility

- Semantic HTML structure
- Keyboard navigation support
- ARIA labels for status indicators
- Color contrast compliance
- Screen reader friendly

## Performance

- Efficient filtering and sorting
- Memoization opportunities for large datasets
- Responsive chart rendering
- Minimal re-renders on interaction

## Future Enhancements

Potential improvements for future iterations:

1. Export drift data to CSV/Excel
2. Time-series view of drift over multiple periods
3. Feature grouping by category
4. Drift trend indicators
5. Automated alerts for critical drift
6. Distribution comparison for multiple features simultaneously
7. Statistical test alternatives (Chi-square, Jensen-Shannon)
8. Drill-down to raw data samples
