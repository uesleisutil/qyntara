# RetrainingRecommendations Component

## Overview

The `RetrainingRecommendations` component provides intelligent recommendations for when to retrain machine learning models based on drift detection and performance degradation metrics. It implements Requirements 28.1-28.8 from the dashboard enhancement specification.

## Features

### Core Functionality

1. **Automatic Recommendation Generation** (Req 28.1)
   - Analyzes drift and degradation data
   - Generates recommendations when thresholds are exceeded
   - Displays clear reasoning for recommendations

2. **Data Drift Trigger** (Req 28.2)
   - Recommends retraining when > 30% of features show drift
   - Severity increases with drift percentage
   - Estimates performance improvement based on drift magnitude

3. **Concept Drift Trigger** (Req 28.3)
   - Detects changes in feature-target relationships
   - High priority trigger for concept drift
   - Suggests model architecture review

4. **Performance Degradation Trigger** (Req 28.4)
   - Monitors degradation duration
   - Critical priority when degradation persists > 14 days
   - High priority when degradation persists > 7 days

5. **Priority Classification** (Req 28.5)
   - Four priority levels: low, medium, high, critical
   - Color-coded visual indicators
   - Priority badges for quick identification

6. **Performance Improvement Estimates** (Req 28.6)
   - Calculates expected improvement percentage
   - Based on drift magnitude and degradation duration
   - Capped at 25% maximum improvement

7. **Training History** (Req 28.7)
   - Displays days since last training
   - Human-readable time formatting
   - Contextual information for decision-making

8. **Interactive Checklist** (Req 28.8)
   - 8-step retraining workflow
   - Clickable items to track progress
   - Progress bar visualization
   - Detailed descriptions for each step

## Props

```typescript
interface RetrainingRecommendationsProps {
  driftedFeaturesPercentage?: number;      // Percentage of features with drift (0-100)
  conceptDriftDetected?: boolean;          // Whether concept drift is detected
  performanceDegradationDays?: number;     // Days of continuous degradation
  daysSinceLastTraining?: number;          // Days since last model training
  darkMode?: boolean;                      // Dark mode theme
  isMobile?: boolean;                      // Mobile layout optimization
}
```

## Usage

```tsx
import { RetrainingRecommendations } from './RetrainingRecommendations';

<RetrainingRecommendations
  driftedFeaturesPercentage={35.5}
  conceptDriftDetected={true}
  performanceDegradationDays={10}
  daysSinceLastTraining={45}
  darkMode={false}
  isMobile={false}
/>
```

## Component States

### No Recommendation State
- Displayed when no triggers are active
- Shows green checkmark icon
- Displays "No Retraining Required" message
- Shows time since last training

### Recommendation Active State
- Priority-based color coding
- Displays all active triggers
- Shows expected improvement estimate
- Displays time since last training
- Lists active trigger count

## Priority Levels

### Critical (Red)
- > 50% features drifted, OR
- Performance degradation > 14 days
- Immediate action required

### High (Orange)
- 40-50% features drifted, OR
- Concept drift detected, OR
- Performance degradation 7-14 days
- Action required soon

### Medium (Yellow)
- 30-40% features drifted
- Monitor closely

### Low (Blue)
- Minor issues detected
- Plan for future retraining

## Retraining Checklist

The component provides an 8-step checklist:

1. **Review drift analysis** - Identify affected features and root causes
2. **Collect and validate data** - Ensure data quality for retraining
3. **Update feature engineering** - Adjust transformations based on drift
4. **Retrain models** - Execute training pipeline
5. **Validate performance** - Test on holdout set
6. **Run backtesting** - Verify on recent historical data
7. **Deploy to staging** - Test before production
8. **Monitor post-deployment** - Track metrics after deployment

Additional step for concept drift:
- **Review model architecture** - Consider structural changes

## Styling

The component supports:
- Dark mode with appropriate color schemes
- Mobile-responsive layouts
- Priority-based color coding
- Smooth transitions and animations
- Accessible color contrasts

## Accessibility

- Semantic HTML structure
- ARIA labels on status badges
- Keyboard navigation support
- Color-blind friendly indicators
- Screen reader compatible

## Integration

The component is integrated into the `DriftDetectionTab` and receives data from the `useDrift` hook. Expected data structure:

```typescript
{
  drifted_features: Feature[],
  all_features: Feature[],
  concept_drift_detected: boolean,
  performance_degradation_days: number,
  days_since_last_training: number
}
```

## Testing

Key test scenarios:
- No recommendation state
- Single trigger activation
- Multiple trigger activation
- Priority level calculation
- Checklist interaction
- Dark mode rendering
- Mobile layout
- Expected improvement calculation

## Future Enhancements

Potential improvements:
- Persist checklist state across sessions
- Add retraining scheduling
- Integration with training pipeline
- Historical recommendation tracking
- Custom checklist items
- Email/notification integration
