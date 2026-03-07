# Dashboard Custom Hooks

This directory contains custom React hooks for fetching and managing dashboard data using React Query.

## Overview

All hooks use `@tanstack/react-query` for data fetching, caching, and automatic refetching. They provide a consistent interface for accessing the dashboard API.

## Hooks

### useMetrics

Fetches performance metrics with automatic refresh every 30 seconds.

**Usage:**
```javascript
import { useMetrics } from './hooks';

function MyComponent() {
  const { data, isLoading, isError, error } = useMetrics({
    stockSymbol: 'PETR4',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    bucket: 'my-bucket',
    enabled: true,
    refetchInterval: 30000
  });

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error: {error.message}</div>;

  return <div>MAPE: {data.summary.avg_mape}</div>;
}
```

**Parameters:**
- `stockSymbol` (string, optional): Filter by stock symbol
- `startDate` (string, optional): Start date (YYYY-MM-DD)
- `endDate` (string, optional): End date (YYYY-MM-DD)
- `bucket` (string, optional): S3 bucket name
- `enabled` (boolean, default: true): Enable/disable the query
- `refetchInterval` (number, default: 30000): Auto-refresh interval in ms

**Returns:**
- `data`: Performance metrics data
- `isLoading`: Loading state
- `isError`: Error state
- `error`: Error object
- `refetch`: Manual refetch function

---

### usePredictions

Fetches predictions with caching, filtered by stock and date.

**Usage:**
```javascript
import { usePredictions } from './hooks';

function PredictionView() {
  const { data, isLoading } = usePredictions({
    stockSymbol: 'VALE3',
    date: '2024-01-15',
    bucket: 'my-bucket'
  });

  return (
    <div>
      <p>Prediction: {data?.ensemble_prediction}</p>
      <p>Lower Bound: {data?.lower_bound}</p>
      <p>Upper Bound: {data?.upper_bound}</p>
    </div>
  );
}
```

**Parameters:**
- `stockSymbol` (string, required): Stock symbol
- `date` (string, default: today): Date (YYYY-MM-DD)
- `bucket` (string, optional): S3 bucket name
- `enabled` (boolean, default: true): Enable/disable the query

**Returns:**
- `data`: Prediction details
- `isLoading`: Loading state
- `isError`: Error state
- `error`: Error object

**Related Hooks:**
- `useModelComparison`: Fetches model comparison data

---

### useModels

Fetches model metadata and comparison data with caching.

**Usage:**
```javascript
import { useModels } from './hooks';

function ModelInsights() {
  const { data, isLoading, refetch } = useModels({
    stockSymbol: 'PETR4',
    lookbackDays: 90,
    bucket: 'my-bucket'
  });

  return (
    <div>
      <h3>Current Weights</h3>
      <ul>
        {Object.entries(data.weights?.current_weights || {}).map(([model, weight]) => (
          <li key={model}>{model}: {(weight * 100).toFixed(1)}%</li>
        ))}
      </ul>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

**Parameters:**
- `stockSymbol` (string, optional): Filter by stock symbol
- `lookbackDays` (number, default: 90): Number of days of history
- `bucket` (string, optional): S3 bucket name
- `enabled` (boolean, default: true): Enable/disable the query

**Returns:**
- `data`: Combined model metadata (weights and hyperparameters)
- `isLoading`: Loading state
- `isError`: Error state
- `error`: Error object
- `refetch`: Manual refetch function

**Related Hooks:**
- `useEnsembleWeights`: Fetches only ensemble weights
- `useHyperparameterHistory`: Fetches only hyperparameter history

---

### useDrift

Fetches drift status with auto-refresh every minute.

**Usage:**
```javascript
import { useDrift } from './hooks';

function DriftMonitor() {
  const { data, isLoading, refresh } = useDrift({
    lookbackDays: 30,
    bucket: 'my-bucket',
    refetchInterval: 60000
  });

  return (
    <div>
      <h3>Drift Status</h3>
      <p>Performance Drift: {data?.current_status?.performance ? 'Yes' : 'No'}</p>
      <p>Feature Drift Count: {data?.current_status?.feature ? 'Yes' : 'No'}</p>
      <p>Events: {data?.drift_events?.length || 0}</p>
      <button onClick={refresh}>Refresh Now</button>
    </div>
  );
}
```

**Parameters:**
- `lookbackDays` (number, default: 30): Number of days to look back
- `bucket` (string, optional): S3 bucket name
- `enabled` (boolean, default: true): Enable/disable the query
- `refetchInterval` (number, default: 60000): Auto-refresh interval in ms

**Returns:**
- `data`: Drift status data
- `isLoading`: Loading state
- `isError`: Error state
- `error`: Error object
- `refresh`: Manual refresh function (invalidates cache)

---

### useExplainability

Fetches SHAP values and feature importance for model explainability.

**Usage:**
```javascript
import { useExplainability } from './hooks';

function ExplainabilityPanel() {
  const { data, isLoading } = useExplainability({
    stockSymbol: 'PETR4',
    date: '2024-01-15',
    topN: 20,
    bucket: 'my-bucket'
  });

  return (
    <div>
      <h3>Top Features</h3>
      <ul>
        {data?.featureImportance?.feature_importance?.map((feat, idx) => (
          <li key={idx}>{feat.feature}: {feat.importance.toFixed(4)}</li>
        ))}
      </ul>
    </div>
  );
}
```

**Parameters:**
- `stockSymbol` (string, optional): Stock symbol
- `date` (string, default: today): Date (YYYY-MM-DD)
- `topN` (number, default: 20): Number of top features to return
- `bucket` (string, optional): S3 bucket name
- `enabled` (boolean, default: true): Enable/disable the query

**Returns:**
- `data`: Combined explainability data (feature importance and prediction details)
- `isLoading`: Loading state
- `isError`: Error state
- `error`: Error object
- `refetch`: Manual refetch function

**Related Hooks:**
- `useFeatureImportance`: Fetches only feature importance
- `usePredictionExplainability`: Fetches only prediction explainability

---

## Configuration

### API Base URL

Set the API base URL using the `REACT_APP_API_BASE_URL` environment variable:

```bash
REACT_APP_API_BASE_URL=https://api.example.com
```

Default: `/api`

### React Query Setup

Wrap your app with `QueryClientProvider`:

```javascript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 30000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

## Testing

All hooks include unit tests. Run tests with:

```bash
npm test -- --testPathPattern=hooks
```

## Requirements

- React 18+
- @tanstack/react-query 5.17+

## Architecture

All hooks follow these patterns:

1. **Caching**: Data is cached to reduce API calls
2. **Auto-refresh**: Critical data (metrics, drift) auto-refreshes
3. **Error handling**: Built-in retry logic with exponential backoff
4. **Type safety**: TypeScript types available in `src/types/`
5. **Composability**: Hooks can be combined for complex queries

## API Endpoints

Hooks map to these API endpoints:

- `/api/metrics` - Performance metrics
- `/api/prediction-details` - Prediction details
- `/api/model-comparison` - Model comparison
- `/api/ensemble-weights` - Ensemble weights
- `/api/hyperparameter-history` - Hyperparameter history
- `/api/drift-status` - Drift detection status
- `/api/feature-importance` - Feature importance (SHAP)

## Performance Considerations

- **Stale Time**: How long data is considered fresh (no refetch)
- **Cache Time**: How long unused data stays in cache
- **Refetch Interval**: Auto-refresh frequency for real-time data
- **Retry Logic**: Automatic retries with exponential backoff

Adjust these values based on your data freshness requirements and API rate limits.
