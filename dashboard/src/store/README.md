# Dashboard State Management

This directory contains Zustand stores for managing global state in the B3 Model Optimization Dashboard.

## Store Overview

### `dashboardStore.js`

The main dashboard store manages:
- **Selected Stock**: Currently selected stock symbol for filtering
- **Date Range**: Start and end dates for filtering metrics and predictions
- **Selected Models**: Array of models to display in comparison views
- **Theme**: UI theme preference (light/dark)
- **Preferences**: Various UI preferences (confidence bands, auto-refresh, etc.)

## Usage

### Basic Usage

```javascript
import useDashboardStore from './store/dashboardStore';

function MyComponent() {
  // Access state and actions
  const selectedStock = useDashboardStore((state) => state.selectedStock);
  const setSelectedStock = useDashboardStore((state) => state.setSelectedStock);
  
  // Use in component
  return (
    <div>
      <p>Selected: {selectedStock || 'All Stocks'}</p>
      <button onClick={() => setSelectedStock('PETR4')}>
        Select PETR4
      </button>
    </div>
  );
}
```

### Selecting Multiple State Values

```javascript
import useDashboardStore from './store/dashboardStore';

function FilterPanel() {
  // Select multiple values at once
  const { selectedStock, dateRange, setSelectedStock, setDateRange } = 
    useDashboardStore((state) => ({
      selectedStock: state.selectedStock,
      dateRange: state.dateRange,
      setSelectedStock: state.setSelectedStock,
      setDateRange: state.setDateRange
    }));
  
  return (
    <div>
      <StockSelector 
        value={selectedStock} 
        onChange={setSelectedStock} 
      />
      <DateRangePicker 
        value={dateRange} 
        onChange={setDateRange} 
      />
    </div>
  );
}
```

### Using Selectors for Performance

```javascript
import { shallow } from 'zustand/shallow';
import useDashboardStore from './store/dashboardStore';

function ModelSelector() {
  // Use shallow comparison to prevent unnecessary re-renders
  const { selectedModels, toggleModel } = useDashboardStore(
    (state) => ({
      selectedModels: state.selectedModels,
      toggleModel: state.toggleModel
    }),
    shallow
  );
  
  return (
    <div>
      {['ensemble', 'deepar', 'lstm', 'prophet', 'xgboost'].map(model => (
        <Checkbox
          key={model}
          checked={selectedModels.includes(model)}
          onChange={() => toggleModel(model)}
          label={model}
        />
      ))}
    </div>
  );
}
```

## State Structure

```javascript
{
  // Filters
  selectedStock: null,              // string | null
  dateRange: {
    start: '2024-01-01',           // string (YYYY-MM-DD)
    end: '2024-12-31'              // string (YYYY-MM-DD)
  },
  selectedModels: [                // string[]
    'ensemble',
    'deepar',
    'lstm',
    'prophet',
    'xgboost'
  ],
  
  // UI Settings
  theme: 'light',                  // 'light' | 'dark'
  preferences: {
    showConfidenceBands: true,     // boolean
    autoRefresh: true,             // boolean
    refreshInterval: 30000,        // number (milliseconds)
    alertsOnly: false,             // boolean
    topN: 20                       // number
  }
}
```

## Actions

### Filter Actions

- **`setSelectedStock(stock)`**: Set the selected stock symbol
  - `stock`: string | null - Stock symbol (e.g., 'PETR4') or null for all stocks

- **`setDateRange(range)`**: Set the date range for filtering
  - `range`: { start: string, end: string } - Date range in YYYY-MM-DD format

- **`toggleModel(model)`**: Toggle a model in the selected models list
  - `model`: string - Model name ('ensemble', 'deepar', 'lstm', 'prophet', 'xgboost')

- **`setSelectedModels(models)`**: Set all selected models at once
  - `models`: string[] - Array of model names

- **`resetFilters()`**: Reset all filters to default values

### UI Actions

- **`setTheme(theme)`**: Set the UI theme
  - `theme`: 'light' | 'dark'

- **`updatePreferences(newPreferences)`**: Update UI preferences
  - `newPreferences`: Partial<Preferences> - Preferences to update

- **`reset()`**: Reset all state to initial values

## Examples

### Stock Filter Component

```javascript
import useDashboardStore from './store/dashboardStore';

function StockFilter() {
  const selectedStock = useDashboardStore((state) => state.selectedStock);
  const setSelectedStock = useDashboardStore((state) => state.setSelectedStock);
  
  const stocks = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4'];
  
  return (
    <select 
      value={selectedStock || ''} 
      onChange={(e) => setSelectedStock(e.target.value || null)}
    >
      <option value="">All Stocks</option>
      {stocks.map(stock => (
        <option key={stock} value={stock}>{stock}</option>
      ))}
    </select>
  );
}
```

### Date Range Picker Component

```javascript
import useDashboardStore from './store/dashboardStore';

function DateRangeFilter() {
  const dateRange = useDashboardStore((state) => state.dateRange);
  const setDateRange = useDashboardStore((state) => state.setDateRange);
  
  return (
    <div>
      <input
        type="date"
        value={dateRange.start}
        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
      />
      <input
        type="date"
        value={dateRange.end}
        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
      />
    </div>
  );
}
```

### Theme Toggle Component

```javascript
import useDashboardStore from './store/dashboardStore';

function ThemeToggle() {
  const theme = useDashboardStore((state) => state.theme);
  const setTheme = useDashboardStore((state) => state.setTheme);
  
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

### Preferences Panel Component

```javascript
import useDashboardStore from './store/dashboardStore';

function PreferencesPanel() {
  const preferences = useDashboardStore((state) => state.preferences);
  const updatePreferences = useDashboardStore((state) => state.updatePreferences);
  
  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={preferences.showConfidenceBands}
          onChange={(e) => updatePreferences({ showConfidenceBands: e.target.checked })}
        />
        Show Confidence Bands
      </label>
      
      <label>
        <input
          type="checkbox"
          checked={preferences.autoRefresh}
          onChange={(e) => updatePreferences({ autoRefresh: e.target.checked })}
        />
        Auto Refresh
      </label>
      
      <label>
        Top N Items:
        <input
          type="number"
          value={preferences.topN}
          onChange={(e) => updatePreferences({ topN: parseInt(e.target.value) })}
        />
      </label>
    </div>
  );
}
```

## Testing

The store includes comprehensive unit tests in `dashboardStore.test.js`. Run tests with:

```bash
npm test dashboardStore.test.js
```

## Best Practices

1. **Use Selectors**: Only select the state you need to prevent unnecessary re-renders
2. **Shallow Comparison**: Use `shallow` from `zustand/shallow` when selecting multiple values
3. **Action Naming**: Actions are named with verbs (set, toggle, update, reset)
4. **Immutability**: All state updates are immutable
5. **Type Safety**: Consider adding TypeScript for better type safety

## Integration with React Query

The dashboard store works seamlessly with React Query for data fetching:

```javascript
import useDashboardStore from './store/dashboardStore';
import { useMetrics } from './hooks/useMetrics';

function MetricsPanel() {
  const { selectedStock, dateRange } = useDashboardStore((state) => ({
    selectedStock: state.selectedStock,
    dateRange: state.dateRange
  }));
  
  // React Query automatically refetches when selectedStock or dateRange changes
  const { data, isLoading } = useMetrics(selectedStock, dateRange);
  
  if (isLoading) return <LoadingSpinner />;
  
  return <MetricsDisplay data={data} />;
}
```

## Future Enhancements

Potential future additions to the store:
- Persist state to localStorage
- Add undo/redo functionality
- Add state history tracking
- Add middleware for logging state changes
- Add TypeScript types
