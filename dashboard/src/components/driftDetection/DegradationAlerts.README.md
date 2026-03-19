# DegradationAlerts Component

## Overview

The `DegradationAlerts` component monitors and displays performance degradation alerts for machine learning models. It implements comprehensive alerting for MAPE, accuracy, and Sharpe ratio metrics, correlates degradation with drift events, and maintains alert history.

## Requirements Implemented

- **27.1**: Monitor performance metrics on the Drift Detection tab
- **27.2**: Alert when MAPE increases by more than 20% relative to baseline
- **27.3**: Alert when accuracy decreases by more than 10 percentage points
- **27.4**: Alert when Sharpe ratio decreases by more than 0.5
- **27.5**: Display active degradation alerts in the notification center
- **27.6**: Display magnitude and duration of performance degradation
- **27.7**: Correlate degradation with detected drift events
- **27.8**: Track degradation alert history

## Features

### Active Alerts
- Real-time monitoring of performance metrics
- Severity classification (low, medium, high, critical)
- Visual indicators with color-coded backgrounds
- Expandable alert details
- Magnitude and duration display

### Drift Correlation
- Automatic correlation with data drift events
- Automatic correlation with concept drift events
- Display of correlated events within degradation period
- Visual representation of drift-degradation relationships

### Alert History
- Persistent tracking of all alerts
- Chronological display of past alerts
- Severity badges for quick identification
- Timestamp and duration information

## Props

```typescript
interface DegradationAlertsProps {
  performanceDegradation?: PerformanceDegradation[];
  driftEvents?: Array<{
    date: string;
    type: 'performance' | 'feature' | 'data';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  darkMode?: boolean;
  isMobile?: boolean;
}
```

### performanceDegradation
Array of performance degradation metrics containing:
- `metric`: Metric name (mape, accuracy, sharpe_ratio)
- `current`: Current metric value
- `baseline`: Baseline metric value
- `change`: Absolute change from baseline
- `changePercentage`: Percentage change from baseline
- `degraded`: Whether degradation threshold is exceeded
- `duration`: Number of days degradation has persisted
- `severity`: Alert severity level
- `threshold`: Degradation threshold value
- `firstDetected`: ISO timestamp of first detection

### driftEvents
Array of drift events for correlation:
- `date`: ISO timestamp of drift event
- `type`: Type of drift (performance, feature, data)
- `description`: Human-readable description
- `severity`: Event severity level

### darkMode
Boolean flag for dark mode styling (default: false)

### isMobile
Boolean flag for mobile-responsive layout (default: false)

## Usage

```tsx
import { DegradationAlerts } from './components/driftDetection/DegradationAlerts';

function DriftDetectionTab() {
  const { data } = useDrift();

  return (
    <DegradationAlerts
      performanceDegradation={data.performance_degradation}
      driftEvents={data.drift_events}
      darkMode={false}
      isMobile={false}
    />
  );
}
```

## Alert Severity Levels

### Critical
- Accuracy decrease > 15 percentage points
- MAPE increase > 30%
- Sharpe ratio decrease > 0.8
- Multiple metrics degraded simultaneously

### High
- Accuracy decrease 10-15 percentage points
- MAPE increase 20-30%
- Sharpe ratio decrease 0.5-0.8

### Medium
- Accuracy decrease 5-10 percentage points
- MAPE increase 10-20%
- Sharpe ratio decrease 0.3-0.5

### Low
- Minor degradation below medium thresholds
- Early warning indicators

## Drift Correlation Algorithm

The component correlates degradation with drift events using temporal proximity:

1. Calculate degradation start date (current date - duration)
2. Filter drift events within degradation period
3. Identify data drift and concept drift events
4. Display top 3 most relevant correlated events
5. Show correlation in expanded alert details

## Styling

The component uses inline styles with theme-aware colors:

- Supports light and dark modes
- Color-coded severity levels
- Responsive layout for mobile devices
- Accessible color contrasts (WCAG AA compliant)

## Accessibility

- Semantic HTML structure
- ARIA labels for status indicators
- Keyboard navigation support
- Screen reader friendly
- High contrast color schemes

## Testing

Comprehensive test coverage includes:
- Active alert display
- Empty state handling
- Magnitude and duration display
- Threshold validation for all metrics
- Drift correlation
- Alert history tracking
- Dark mode rendering
- Mobile layout rendering

Run tests:
```bash
npm test DegradationAlerts.test.tsx
```

## Integration with Notification Center

Alerts displayed in this component are also sent to the NotificationCenter component (Requirement 27.5). The integration happens at the API level where degradation alerts are created as notifications.

## Performance Considerations

- Efficient re-rendering with React hooks
- Memoized correlation calculations
- Limited history display (50 most recent alerts)
- Lazy rendering of expanded details

## Future Enhancements

- Configurable alert thresholds
- Email/SMS notification integration
- Alert acknowledgment workflow
- Custom alert rules
- Export alert history
- Alert analytics dashboard
