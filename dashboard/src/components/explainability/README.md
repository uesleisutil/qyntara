# Explainability Components

This directory contains components for the Explainability Tab, which provides model interpretability features.

## Components

### ExplainabilityTab
Main container component that orchestrates all explainability features.
- **Requirements**: 29.1, 30.1, 31.1, 32.1
- **Features**: Ticker selection, tab layout, component integration

### SHAPWaterfallChart
Displays SHAP (SHapley Additive exPlanations) values as a waterfall chart.
- **Requirements**: 29.1-29.8
- **Features**:
  - Waterfall visualization using D3.js
  - Base value and final prediction display
  - Color-coded contributions (positive/negative)
  - Sorted by absolute SHAP magnitude
  - Top 15 features displayed
  - Interactive tooltips

### SensitivityAnalysis
Analyzes how predictions change when feature values vary.
- **Requirements**: 30.1-30.8
- **Features**:
  - Feature selection (up to 5 features)
  - Sensitivity calculation across feature ranges
  - Line chart visualization using Recharts
  - Sensitivity scores (% change per unit)
  - Multi-feature comparison

### FeatureImpactChart
Shows aggregate feature impact across all predictions.
- **Requirements**: 31.1-31.8
- **Features**:
  - Average absolute SHAP values
  - Horizontal bar chart (top 20 features)
  - Ranked by impact
  - Distribution statistics (box plot data)
  - Sector filtering
  - Historical comparison

### ExplanationText
Generates natural language explanations for predictions.
- **Requirements**: 32.1-32.8
- **Features**:
  - Top 3 positive contributing features
  - Top 3 negative contributing features
  - Magnitude descriptions
  - Comparison against typical values
  - Confidence level explanation
  - Non-technical language

## Usage

```tsx
import { ExplainabilityTab } from './components/explainability';

function App() {
  return <ExplainabilityTab darkMode={false} />;
}
```

## Data Flow

All components currently use mock data for demonstration. To integrate with real data:

1. Replace mock data fetching in each component with actual API calls
2. Update the API endpoints in the backend (see subtask 11.9)
3. Ensure SHAP values are calculated using the `shap` Python library

## Backend Integration

The backend Lambda functions should provide the following endpoints:
- `/api/explainability/shap` - SHAP values for a specific ticker
- `/api/explainability/sensitivity` - Sensitivity analysis data
- `/api/explainability/aggregate-impact` - Aggregate feature impacts
- `/api/explainability/explanation` - Natural language explanation data

## Testing

Property-based tests for SHAP values and sensitivity analysis are defined in subtasks 11.3, 11.5, 11.7, and 11.10 (marked as optional).

## Dependencies

- **D3.js**: For SHAP waterfall chart visualization
- **Recharts**: For sensitivity analysis line charts and feature impact bar charts
- **lucide-react**: For icons
