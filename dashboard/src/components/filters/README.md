# Filter Components

This directory contains reusable filter components for the dashboard.

## Components

### StockSelector
Stock selection with search and autocomplete functionality.

**Features:**
- Search/filter stocks by typing
- Autocomplete dropdown with filtered results
- Keyboard navigation (arrow keys, enter, escape)
- Click outside to close
- Clear button to reset selection

**Props:**
- `value` (string): Currently selected stock symbol
- `onChange` (function): Callback when selection changes
- `stocks` (array): Optional array of stock symbols (defaults to common B3 stocks)
- `placeholder` (string): Input placeholder text

**Example:**
```jsx
<StockSelector
  value={selectedStock}
  onChange={setSelectedStock}
  stocks={['PETR4', 'VALE3', 'ITUB4']}
  placeholder="Search stocks..."
/>
```

### DateRangePicker
Date range selection with preset buttons.

**Features:**
- Start and end date inputs
- Quick preset buttons (Last 7/30/90 days, YTD, All time)
- Date validation (end must be after start)
- Error messages for invalid ranges

**Props:**
- `value` (object): Object with `start` and `end` date strings (YYYY-MM-DD)
- `onChange` (function): Callback when date range changes

**Example:**
```jsx
<DateRangePicker
  value={{ start: '2024-01-01', end: '2024-12-31' }}
  onChange={setDateRange}
/>
```

### ModelSelector
Model selection with single or multi-select modes.

**Features:**
- Single select dropdown or multi-select toggle buttons
- Visual color coding for each model
- Select all / Clear all for multi-select
- Selection count display

**Props:**
- `value` (string or array): Selected model(s)
- `onChange` (function): Callback when selection changes
- `multiSelect` (boolean): Enable multi-select mode

**Example:**
```jsx
// Single select
<ModelSelector
  value={selectedModel}
  onChange={setSelectedModel}
/>

// Multi-select
<ModelSelector
  value={selectedModels}
  onChange={setSelectedModels}
  multiSelect
/>
```

### MetricSelector
Metric selection dropdown with grouped options.

**Features:**
- Grouped metrics by category (Accuracy, Coverage, Performance)
- Optional metric descriptions
- Organized optgroups

**Props:**
- `value` (string): Selected metric ID
- `onChange` (function): Callback when selection changes
- `showDescription` (boolean): Show metric description below dropdown

**Example:**
```jsx
<MetricSelector
  value={selectedMetric}
  onChange={setSelectedMetric}
  showDescription
/>
```

## Usage

Import components individually or as a group:

```jsx
import { StockSelector, DateRangePicker, ModelSelector, MetricSelector } from './components/filters';
```

## Styling

All components use TailwindCSS for styling and follow a consistent design system:
- Blue accent color (#3B82F6)
- Gray text and borders
- Rounded corners (rounded-lg)
- Focus states with ring
- Hover transitions
