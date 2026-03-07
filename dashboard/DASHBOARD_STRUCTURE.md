# Dashboard Project Structure

## Directory Organization

```
dashboard/
├── public/                    # Static assets
│   ├── index.html
│   └── favicon.ico
│
├── src/
│   ├── components/
│   │   ├── charts/           # Chart components
│   │   │   ├── MAPETimeSeriesChart.jsx
│   │   │   ├── ModelComparisonChart.jsx
│   │   │   ├── FeatureImportanceChart.jsx
│   │   │   ├── DriftDetectionChart.jsx
│   │   │   ├── PredictionIntervalChart.jsx
│   │   │   ├── EnsembleWeightsChart.jsx
│   │   │   └── StockRankingChart.jsx
│   │   │
│   │   ├── panels/           # Panel components
│   │   │   ├── ModelPerformancePanel.jsx
│   │   │   ├── EnsembleInsightsPanel.jsx
│   │   │   ├── FeatureAnalysisPanel.jsx
│   │   │   ├── DriftMonitoringPanel.jsx
│   │   │   ├── ExplainabilityPanel.jsx
│   │   │   └── HyperparameterPanel.jsx
│   │   │
│   │   ├── filters/          # Filter components
│   │   │   ├── StockSelector.jsx
│   │   │   ├── DateRangePicker.jsx
│   │   │   ├── ModelSelector.jsx
│   │   │   └── MetricSelector.jsx
│   │   │
│   │   └── shared/           # Shared components
│   │       ├── LoadingSpinner.jsx
│   │       ├── ErrorBoundary.jsx
│   │       ├── Tooltip.jsx
│   │       ├── Card.jsx
│   │       └── MetricCard.jsx
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useMetrics.js
│   │   ├── usePredictions.js
│   │   ├── useModels.js
│   │   ├── useDrift.js
│   │   └── useExplainability.js
│   │
│   ├── store/                # Zustand state management
│   │   ├── dashboardStore.js
│   │   └── filterStore.js
│   │
│   ├── services/             # API services
│   │   ├── api.js
│   │   └── s3Client.js
│   │
│   ├── types/                # TypeScript type definitions
│   │   ├── metrics.ts
│   │   ├── ensemble.ts
│   │   ├── drift.ts
│   │   └── explainability.ts
│   │
│   ├── utils/                # Utility functions
│   │   ├── formatters.js
│   │   ├── calculations.js
│   │   └── colors.js
│   │
│   ├── App.js                # Main app component
│   ├── index.js              # Entry point
│   └── index.css             # Global styles
│
├── package.json              # npm dependencies
├── setup_dashboard.sh        # Setup script
└── DASHBOARD_STRUCTURE.md    # This file
```

## Component Responsibilities

### Charts (`src/components/charts/`)

#### MAPETimeSeriesChart
- Multi-line chart showing MAPE evolution over time
- Displays ensemble + individual models (DeepAR, LSTM, Prophet, XGBoost)
- Features: confidence bands, zoom/pan, hover tooltips, threshold line at 7%
- Annotations for retraining events

#### ModelComparisonChart
- Radar chart comparing 4 models across multiple metrics
- Metrics: MAPE, coverage, interval width, training time, inference speed
- Interactive: click to highlight, hover for details

#### FeatureImportanceChart
- Horizontal bar chart showing SHAP feature importance
- Top 20 features by default
- Color-coded by feature category (technical, volume, lag, etc.)
- Click bar to see feature distribution

#### DriftDetectionChart
- Heatmap showing KS test p-values for all features over time
- Red = drift detected (p < 0.05), Green = no drift
- Click cell to see feature distribution comparison

#### PredictionIntervalChart
- Fan chart showing prediction intervals with actual values
- Shows 50%, 80%, 95% confidence intervals
- Hover to see exact values and coverage

#### EnsembleWeightsChart
- Stacked area chart showing ensemble weight evolution
- Shows how weights change over time based on performance
- Click to see weight calculation details

#### StockRankingChart
- Bump chart showing stock ranking changes over time
- Top 20 stocks by MAPE
- Click stock to see detailed metrics

### Panels (`src/components/panels/`)

#### ModelPerformancePanel
- Main performance dashboard
- Metric cards: MAPE, coverage, interval width, top performers
- Integrates MAPETimeSeriesChart and ModelComparisonChart
- Stock and date range filters

#### EnsembleInsightsPanel
- Current ensemble weights and contributions
- Prediction breakdown table
- EnsembleWeightsChart and pie chart
- Model contribution analysis

#### FeatureAnalysisPanel
- Tabs: feature importance, distributions, correlations
- FeatureImportanceChart and heatmap
- Stock and date filters
- Feature category filtering

#### DriftMonitoringPanel
- Drift summary with status badges
- Performance and feature drift charts
- Drift events timeline
- Alerts-only toggle

#### ExplainabilityPanel
- Recent predictions selector
- SHAP waterfall chart
- Feature values table with contributions
- Dominant model identification

#### HyperparameterPanel
- Hyperparameter history per model
- Optimization progress visualization
- Best trials display

### Filters (`src/components/filters/`)

#### StockSelector
- Dropdown with search and autocomplete
- Multi-select support
- Recent selections

#### DateRangePicker
- Calendar-based date selection
- Presets: Last 7 days, Last 30 days, Last 90 days, YTD, Custom
- Validation for valid date ranges

#### ModelSelector
- Multi-select checkbox list
- Select all / deselect all
- Individual model toggles

#### MetricSelector
- Dropdown for metric selection
- Options: MAPE, MAE, RMSE, Coverage, Interval Width

### Shared Components (`src/components/shared/`)

#### LoadingSpinner
- Animated loading indicator
- Customizable size and color
- Used across all async components

#### ErrorBoundary
- Catches React errors
- Displays user-friendly error message
- Logs errors to console

#### Tooltip
- Reusable tooltip component
- Customizable position and content
- Used in charts and info icons

#### Card
- Container component with consistent styling
- Title, icon, and action buttons
- Collapsible support

#### MetricCard
- Displays single metric with trend
- Color-coded by target achievement
- Sparkline for historical trend

## Custom Hooks (`src/hooks/`)

### useMetrics
- Fetches performance metrics from API
- Auto-refresh every 30 seconds
- Caching with React Query
- Filters: stock symbol, date range

### usePredictions
- Fetches predictions with caching
- Filters: stock, date range, model
- Pagination support

### useModels
- Fetches model metadata and comparison data
- Caches model information
- Version history

### useDrift
- Fetches drift status with auto-refresh
- Manual refresh function
- Real-time alerts

### useExplainability
- Fetches SHAP values and feature importance
- Prediction-specific queries
- Feature contribution breakdown

## State Management (`src/store/`)

### dashboardStore (Zustand)
- Global dashboard state
- Selected stock, date range, models
- Theme preferences
- UI state (collapsed panels, etc.)

### filterStore (Zustand)
- Filter state management
- Persists to localStorage
- Shared across components

## Services (`src/services/`)

### api.js
- Centralized API client
- Base URL configuration
- Error handling and retries
- Request/response interceptors

### s3Client.js
- AWS S3 client for direct bucket access
- Presigned URL generation
- File upload/download helpers

## Types (`src/types/`)

### metrics.ts
- PerformanceMetrics interface
- ModelMetrics interface
- TimeSeriesMetric interface
- StockMetrics interface

### ensemble.ts
- EnsembleWeights interface
- ModelContribution interface
- PredictionBreakdown interface
- EnsembleInsights interface

### drift.ts
- DriftStatus interface
- FeatureDrift interface
- DriftEvent interface

### explainability.ts
- ExplainabilityData interface
- ShapValue interface
- FeatureContribution interface
- PredictionDetails interface

## Utilities (`src/utils/`)

### formatters.js
- Number formatting (currency, percentage, etc.)
- Date formatting
- Text truncation

### calculations.js
- Metric calculations
- Statistical functions
- Aggregations

### colors.js
- Color palettes for charts
- Model-specific colors
- Status colors (good, warning, critical)

## Dependencies

Key dependencies from `package.json`:
- **react**: UI framework
- **recharts**: Primary charting library
- **d3**: Advanced visualizations
- **plotly.js**: 3D and interactive charts
- **@tanstack/react-query**: Data fetching and caching
- **zustand**: State management
- **framer-motion**: Animations
- **lucide-react**: Icons
- **@aws-sdk/client-s3**: AWS S3 access

## Development Guidelines

1. **Component Structure**: Functional components with hooks
2. **Styling**: CSS modules or styled-components
3. **Type Safety**: Use TypeScript for type definitions
4. **Testing**: Jest + React Testing Library
5. **Accessibility**: WCAG 2.1 AA compliance
6. **Performance**: Lazy loading, memoization, virtualization

## API Endpoints

Dashboard consumes these API endpoints:

- `GET /api/metrics?stock={symbol}&start={date}&end={date}`
- `GET /api/drift?lookback={days}`
- `GET /api/explainability?stock={symbol}&date={date}`
- `GET /api/ensemble-insights?stock={symbol}`
- `GET /api/model-comparison?date={date}`
- `GET /api/hyperparameters?model={type}`

## Environment Variables

Create `.env.local` with:
```
REACT_APP_API_BASE_URL=https://api.example.com
REACT_APP_S3_BUCKET=your-bucket-name
REACT_APP_AWS_REGION=us-east-1
```

## Build and Deployment

### Development
```bash
npm start
```

### Production Build
```bash
npm run build
```

### Deploy to GitHub Pages
```bash
npm run deploy
```

### Deploy to S3 + CloudFront
```bash
aws s3 sync build/ s3://your-bucket-name/
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

## Performance Optimization

1. **Code Splitting**: Lazy load panels and charts
2. **Memoization**: Use React.memo for expensive components
3. **Virtualization**: Use react-window for large lists
4. **Debouncing**: Debounce filter changes
5. **Caching**: Aggressive caching with React Query
6. **Image Optimization**: Use WebP format, lazy loading

## Accessibility

1. **Keyboard Navigation**: All interactive elements accessible via keyboard
2. **Screen Readers**: Proper ARIA labels and roles
3. **Color Contrast**: WCAG AA compliant (4.5:1 ratio)
4. **Focus Indicators**: Visible focus states
5. **Alt Text**: Descriptive alt text for all images

## Next Steps

1. Implement chart components (Task 24)
2. Implement panel components (Task 25)
3. Implement filter components (Task 26)
4. Implement custom hooks (Task 27)
5. Implement state management (Task 28)
6. Integrate with API (Task 29)
