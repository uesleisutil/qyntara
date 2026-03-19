# Data Quality Tab Implementation

## Overview

This directory contains the implementation of the Data Quality Tab for the B3 Tactical Ranking MLOps Dashboard, fulfilling Task 8 requirements.

## Components

### DataQualityTab.tsx
Main container component that orchestrates all data quality sections.

**Requirements Implemented:**
- 21.1: Display Data Quality tab with sections for completeness, anomalies, freshness, coverage

**Features:**
- Period selector (7, 30, 90 days)
- KPI cards for quick metrics overview
- Four main sections: Completeness, Anomalies, Freshness, Coverage
- Responsive design for mobile and desktop

### CompletenessTable.tsx
Displays data completeness metrics per ticker.

**Requirements Implemented:**
- 21.2: Calculate completeness rate per ticker (present / expected * 100)
- 21.3: Display sortable table with completeness rates
- 21.4: Highlight tickers with completeness < 95%
- 21.5: Display overall completeness rate
- 21.6: Show completeness trends over time
- 21.7: Identify missing features per ticker
- 21.8: Display date range analyzed

**Features:**
- Sortable columns (ticker, completeness, missing features)
- Expandable rows showing missing features
- Sparkline trends for each ticker
- Color-coded completeness rates
- Overall completeness summary

### AnomalyList.tsx
Detects and displays data anomalies.

**Requirements Implemented:**
- 22.1: Detect data gaps (missing consecutive trading days)
- 22.2: Detect outliers (> 5 std devs from mean)
- 22.3: Display list with ticker, date, anomaly type
- 22.4: Calculate anomaly rate (anomalies / total * 100)
- 22.5: Display anomaly trends over time
- 22.6: Allow marking false positives
- 22.7: Categorize by severity (low, medium, high)
- 22.8: Requirements validation

**Features:**
- Filter by severity and type
- Mark/unmark false positives
- Anomaly trend chart
- Severity-based color coding
- Detailed anomaly descriptions

### FreshnessIndicators.tsx
Shows data freshness status per source.

**Requirements Implemented:**
- 23.1: Calculate data age (time since last update)
- 23.2: Display freshness status per data source (prices, fundamentals, news)
- 23.3: Show warning when age > 24 hours
- 23.4: Show critical when age > 48 hours
- 23.5: Display timestamp of most recent update
- 23.6: Display expected update frequency
- 23.7: Calculate percentage of current data sources
- 23.8: Requirements validation

**Features:**
- Status badges (current, warning, critical)
- Data age formatting (minutes, hours, days)
- Expected frequency display
- Per-source freshness indicators

### CoverageMetrics.tsx
Tracks universe coverage metrics.

**Requirements Implemented:**
- 24.1: Calculate coverage (covered tickers / universe size * 100)
- 24.2: Display total universe size
- 24.3: Display number of tickers with sufficient data
- 24.4: Display number of excluded tickers with reasons
- 24.5: List excluded tickers
- 24.6: Track coverage trends over time
- 24.7: Highlight when coverage < 90%
- 24.8: Requirements validation

**Features:**
- Coverage progress bar
- Alert when coverage < 90%
- Coverage trend chart
- Expandable excluded tickers list
- Grouped by exclusion reason

## Backend Implementation

### Lambda Endpoints

The following endpoints were added to `ml/src/lambdas/dashboard_api.py`:

1. **GET /api/monitoring/data-quality?days=30**
   - Returns complete data quality metrics
   - Calculates metrics from recommendations history if not cached

2. **GET /api/data-quality/completeness?days=30**
   - Returns only completeness metrics
   - Implements Req 21.1-21.8

3. **GET /api/data-quality/anomalies?days=30**
   - Returns only anomaly detection results
   - Implements Req 22.1-22.8

4. **GET /api/data-quality/freshness?days=30**
   - Returns only freshness indicators
   - Implements Req 23.1-23.8

5. **GET /api/data-quality/coverage?days=30**
   - Returns only coverage metrics
   - Implements Req 24.1-24.8

### Data Quality Calculation

The `calculate_data_quality_metrics()` function in the Lambda handler:
- Analyzes recommendations history
- Calculates completeness per ticker
- Detects data gaps (> 3 days)
- Detects outliers (> 5 std devs)
- Calculates freshness indicators
- Tracks universe coverage
- Generates trends over time

### Caching

Response caching is implemented with 60-minute TTL (Req 80.10):
- Reduces computation overhead
- Improves response times
- Automatic cache invalidation

## Infrastructure

API Gateway routes added in `infra/lib/infra-stack.ts`:
- `/api/data-quality/completeness`
- `/api/data-quality/anomalies`
- `/api/data-quality/freshness`
- `/api/data-quality/coverage`

All routes require API key authentication.

## Usage

### In App.js (Simple Integration)

```javascript
// State
const [dataQuality, setDataQuality] = useState(null);

// Fetch
const response = await fetch(`${API_BASE_URL}/api/monitoring/data-quality?days=30`, {
  headers: { 'x-api-key': API_KEY }
});
const data = await response.json();
setDataQuality(data);

// Render
{activeTab === 'dataQuality' && dataQuality && (
  <DataQualityTab data={dataQuality} darkMode={darkMode} isMobile={isMobile} />
)}
```

### With React Query Hook

```typescript
import { useDataQuality } from '../../hooks/useDataQuality';

const { data, loading, error, refetch } = useDataQuality(30);
```

## Testing

To test the Data Quality Tab:

1. Start the dashboard: `npm start`
2. Navigate to the Data Quality tab
3. Verify all four sections display correctly
4. Test period selector (7, 30, 90 days)
5. Test sorting in completeness table
6. Test anomaly filters
7. Test false positive marking
8. Test excluded tickers expansion

## Performance Considerations

- Data is cached for 60 minutes on the backend
- Frontend auto-refreshes every 5 minutes
- Sparklines use lightweight rendering
- Tables support virtual scrolling for large datasets
- Anomaly list limited to 100 most recent

## Future Enhancements

- Real-time anomaly notifications
- Automated data quality reports
- Integration with alerting system
- Historical data quality trends
- Export data quality reports
- Custom anomaly detection rules
