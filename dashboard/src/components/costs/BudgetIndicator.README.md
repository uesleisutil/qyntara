# BudgetIndicator Component

## Overview

The BudgetIndicator component provides comprehensive budget monitoring with visual alerts, projections, and actionable insights for AWS cost management.

## Features

- **Budget Limit Configuration**: Allow users to set and modify monthly budget limits
- **Visual Status Indicators**: Color-coded status (on-track, warning, critical)
- **Progress Visualization**: Progress bar showing current spend vs budget
- **Warning Alerts**: Display warning at 80% of budget
- **Critical Alerts**: Display critical alert at 100% of budget
- **Percentage Display**: Show current spend as percentage of budget
- **Cost Projections**: Project end-of-month costs based on current trends
- **Time Tracking**: Display days remaining in the current month
- **Daily Spend Analysis**: Calculate required daily spend to stay within budget
- **Comparative Metrics**: Show current vs required daily spending

## Requirements Satisfied

- **19.1**: Display budget status indicators on the Costs tab
- **19.2**: Allow users to configure monthly budget limits
- **19.3**: Display warning indicator when costs reach 80% of budget
- **19.4**: Display critical alert indicator when costs reach 100% of budget
- **19.5**: Display current spend as a percentage of budget
- **19.6**: Project end-of-month costs based on current trends
- **19.7**: Display days remaining in the current month
- **19.8**: Calculate required daily spend to stay within budget

## Usage

```tsx
import BudgetIndicator from './components/costs/BudgetIndicator';

// Basic usage
<BudgetIndicator data={budgetData} />

// With budget configuration callback
<BudgetIndicator 
  data={budgetData} 
  onBudgetChange={(newLimit) => updateBudget(newLimit)}
/>

// With loading state
<BudgetIndicator data={null} isLoading={true} />
```

## Props

### `data`
- **Type**: `BudgetData | null`
- **Required**: Yes
- **Description**: Budget data containing limit, current spend, projections, and time information

```typescript
interface BudgetData {
  budget?: {
    limit?: number;           // Monthly budget limit (default: 1000)
    current: number;          // Current month-to-date spend
    projected: number;        // Projected end-of-month cost
    daysRemaining: number;    // Days remaining in current month
    daysInMonth: number;      // Total days in current month
  };
}
```

### `isLoading`
- **Type**: `boolean`
- **Required**: No
- **Default**: `false`
- **Description**: Whether data is currently loading

### `onBudgetChange`
- **Type**: `(newLimit: number) => void`
- **Required**: No
- **Description**: Callback function when user updates budget limit. If not provided, configuration UI is hidden.

## Budget Status Levels

### On-Track (Green)
- Current spend < 80% of budget
- Projected spend < 100% of budget
- Shows success message

### Warning (Yellow)
- Current spend >= 80% and < 100% of budget
- Shows warning message with recommendations
- Highlights if projection will exceed budget

### Critical (Red)
- Current spend >= 100% of budget
- Shows critical alert requiring immediate action
- Displays overage amount

## Calculated Metrics

### Current Spend Percentage
```
percentage = (current / limit) * 100
```

### Days Elapsed
```
daysElapsed = daysInMonth - daysRemaining
```

### Current Daily Average
```
currentDailyAverage = current / daysElapsed
```

### Required Daily Spend
```
requiredDailySpend = (limit - current) / daysRemaining
```

### Projected Percentage
```
projectedPercentage = (projected / limit) * 100
```

## Visual Elements

### Progress Bar
- Shows current spend as percentage of budget
- Color changes based on status (green/yellow/red)
- Includes markers at 80% (warning) and 100% (critical)
- Displays current and remaining amounts

### Status Badge
- Icon-based status indicator (✓, ⚠️, 🚨)
- Color-coded background and border
- Clear status label

### Metrics Grid
- Days remaining in month
- Projected end-of-month cost
- Current daily average spend
- Required daily spend to stay within budget

### Alert Messages
- Contextual alerts based on status
- Actionable recommendations
- Projection warnings when applicable

## Styling

The component uses theme-aware colors from `useChartColors()`:
- Adapts to light/dark theme
- Consistent with other dashboard components
- Accessible color contrasts

## Testing

Comprehensive test coverage includes:
- Loading and empty states
- All three status levels (on-track, warning, critical)
- Budget configuration workflow
- Calculated metrics accuracy
- Projection warnings
- User interactions (edit, save, cancel)

Run tests:
```bash
npm test BudgetIndicator.test.tsx
```

## Example Data

### On-Track Budget
```typescript
{
  budget: {
    limit: 1000,
    current: 500,
    projected: 800,
    daysRemaining: 15,
    daysInMonth: 30,
  }
}
```

### Warning Status
```typescript
{
  budget: {
    limit: 1000,
    current: 850,
    projected: 1050,
    daysRemaining: 10,
    daysInMonth: 30,
  }
}
```

### Critical Status
```typescript
{
  budget: {
    limit: 1000,
    current: 1100,
    projected: 1200,
    daysRemaining: 5,
    daysInMonth: 30,
  }
}
```

## Accessibility

- Semantic HTML structure
- Color is not the only indicator (icons + text)
- Keyboard accessible configuration form
- Clear, descriptive labels
- Proper contrast ratios

## Integration Notes

### Backend Integration
The component expects budget data from the backend API. Ensure your API endpoint provides:
- Current month-to-date costs
- Budget limit (or use default)
- Projected end-of-month costs
- Days remaining calculation

### State Management
If using the `onBudgetChange` callback:
1. Update backend with new budget limit
2. Refresh budget data
3. Show success/error feedback to user

### Real-time Updates
Consider implementing:
- WebSocket updates for real-time cost tracking
- Periodic polling to refresh projections
- Notification system for status changes

## Future Enhancements

Potential improvements:
- Historical budget performance trends
- Budget vs actual comparison charts
- Multi-month budget planning
- Budget allocation by service
- Automated cost optimization suggestions
- Email/SMS alerts for status changes
- Budget templates and presets
