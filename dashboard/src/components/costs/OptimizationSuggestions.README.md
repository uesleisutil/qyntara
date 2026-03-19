# OptimizationSuggestions Component

## Overview

The `OptimizationSuggestions` component analyzes AWS cost patterns and generates actionable optimization recommendations to reduce spending without impacting functionality.

## Features

- **Pattern Analysis**: Automatically analyzes cost metrics to identify optimization opportunities
- **Service-Specific Suggestions**: Generates targeted suggestions for Lambda, S3, and API Gateway
- **Priority Ranking**: Prioritizes suggestions by potential savings and impact
- **Implementation Guidance**: Provides step-by-step implementation instructions
- **Progress Tracking**: Tracks which suggestions have been implemented
- **Estimated Savings**: Displays monthly savings potential for each suggestion

## Requirements Validation

**Validates Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8**

- ✅ 18.1: Analyzes cost patterns and generates optimization suggestions
- ✅ 18.2: Suggests Lambda memory optimization when execution time exceeds thresholds
- ✅ 18.3: Suggests S3 lifecycle policies when storage costs increase significantly
- ✅ 18.4: Suggests API Gateway caching when request costs are high
- ✅ 18.5: Prioritizes suggestions by potential savings amount
- ✅ 18.6: Displays estimated monthly savings for each suggestion
- ✅ 18.7: Provides implementation guidance for each suggestion
- ✅ 18.8: Tracks which suggestions have been implemented

## Usage

```tsx
import OptimizationSuggestions from './components/costs/OptimizationSuggestions';

// With pre-generated suggestions
<OptimizationSuggestions
  data={{
    cost_optimization: {
      suggestions: [
        {
          id: 'lambda-memory-opt',
          category: 'lambda',
          title: 'Otimizar Memória do Lambda',
          description: 'Tempo médio de execução alto...',
          estimatedSavings: 150.50,
          priority: 'high',
          implemented: false,
          implementationGuide: ['Step 1', 'Step 2'],
          detectedPattern: 'Tempo de execução médio: 6.5s',
        },
      ],
    },
  }}
  onImplement={(id) => console.log('Implemented:', id)}
  onDismiss={(id) => console.log('Dismissed:', id)}
/>

// With metrics (auto-generates suggestions)
<OptimizationSuggestions
  data={{
    cost_optimization: {
      metrics: {
        lambda: {
          avgExecutionTime: 6500,
          avgMemory: 512,
          totalCost: 450,
        },
        s3: {
          storageGrowthRate: 0.15,
          totalCost: 600,
          avgObjectAge: 75,
        },
        apiGateway: {
          requestCount: 150000,
          cacheHitRate: 0.2,
          totalCost: 350,
        },
      },
    },
  }}
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `OptimizationSuggestionsData \| null` | Yes | Cost optimization data with suggestions or metrics |
| `isLoading` | `boolean` | No | Loading state indicator |
| `onImplement` | `(suggestionId: string) => void` | No | Callback when suggestion is marked as implemented |
| `onDismiss` | `(suggestionId: string) => void` | No | Callback when suggestion is dismissed |

## Data Structure

### OptimizationSuggestion

```typescript
interface OptimizationSuggestion {
  id: string;
  category: 'lambda' | 's3' | 'apiGateway' | 'other';
  title: string;
  description: string;
  estimatedSavings: number;
  priority: 'low' | 'medium' | 'high';
  implemented: boolean;
  implementationGuide: string[];
  detectedPattern: string;
}
```

### CostMetrics

```typescript
interface CostMetrics {
  lambda?: {
    avgExecutionTime?: number;
    avgMemory?: number;
    totalCost?: number;
  };
  s3?: {
    storageGrowthRate?: number;
    totalCost?: number;
    avgObjectAge?: number;
  };
  apiGateway?: {
    requestCount?: number;
    cacheHitRate?: number;
    totalCost?: number;
  };
}
```

## Suggestion Generation Logic

### Lambda Optimizations

1. **Memory Optimization** (High Priority)
   - Triggered when: `avgExecutionTime > 5000ms`
   - Estimated savings: 15% of Lambda costs
   - Suggests increasing memory allocation to reduce execution time

2. **Provisioned Concurrency** (Medium Priority)
   - Triggered when: `totalCost > R$ 500`
   - Estimated savings: 10% of Lambda costs
   - Suggests using provisioned concurrency for high-traffic functions

### S3 Optimizations

1. **Lifecycle Policies** (High Priority)
   - Triggered when: `storageGrowthRate > 10%`
   - Estimated savings: 30% of S3 costs
   - Suggests transitioning old data to cheaper storage classes

2. **Intelligent-Tiering** (Medium Priority)
   - Triggered when: `avgObjectAge > 60 days`
   - Estimated savings: 25% of S3 costs
   - Suggests automatic tier optimization based on access patterns

### API Gateway Optimizations

1. **Caching** (High Priority)
   - Triggered when: `requestCount > 100,000` AND `cacheHitRate < 50%`
   - Estimated savings: 40% of API Gateway costs
   - Suggests enabling response caching

2. **Throttling** (Low Priority)
   - Triggered when: `totalCost > R$ 300`
   - Estimated savings: 15% of API Gateway costs
   - Suggests implementing rate limiting

## Priority Levels

- **High**: Potential savings > R$ 150 or critical performance impact
- **Medium**: Moderate savings (R$ 50-150) or moderate impact
- **Low**: Small savings (< R$ 50) or preventive measures

## Styling

The component uses the theme system from `chartConfig`:

- **High Priority**: Red/error color
- **Medium Priority**: Yellow/warning color
- **Low Priority**: Blue/info color
- **Implemented**: Green/success color with reduced opacity

## Accessibility

- Keyboard navigation supported for all interactive elements
- Expandable sections use proper ARIA attributes
- Color coding supplemented with text labels
- High contrast ratios for text readability

## Testing

Run tests with:

```bash
npm test OptimizationSuggestions.test.tsx
```

Test coverage includes:
- Rendering states (loading, empty, with data)
- Suggestion generation from metrics
- Priority sorting
- Expand/collapse functionality
- Callback invocations
- Edge cases and error handling

## Example Output

The component displays:

1. **Header**: Total potential savings and implemented count
2. **Suggestion Cards**: Each showing:
   - Category icon and label
   - Priority badge
   - Title and description
   - Estimated monthly savings
   - Detected pattern
   - Expandable implementation guide
   - Action buttons (implement/dismiss)

## Integration Notes

- Integrates with AWS Cost Explorer API for metrics
- Can work with pre-generated suggestions or generate from metrics
- Supports tracking implementation status via callbacks
- Responsive design adapts to different screen sizes
